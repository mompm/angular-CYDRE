# -*- coding: utf-8 -*-
"""
Created on Wed May  3 10:59:09 2023

@author: Nicolas Cornette
"""

# Modules
import os
import numpy as np
import pandas as pd
import geopandas as gpd
import pickle
from pyproj import Transformer
import requests
from io import BytesIO
import gzip

def save_object(obj, out_path, name):
    # If folder already exists, removes it
    #if os.path.exists(os.path.join(out_path,name)):
     #   os.remove(os.path.join(out_path,name))
    with open(os.path.join(out_path,name), 'wb+') as f:
        pickle.dump(obj, f, pickle.HIGHEST_PROTOCOL)
        
def load_object(out_path, name):
    with open(os.path.join(out_path,name), 'rb') as f:
        return pickle.load(f)


class Surfex():
    """
    Inherits from the Climatic Class of HydroModpy
    
    Clip and extract .h5 Surfex files at the watershed scale.
    
    .h5 files contains:

    """
    
    def __init__(self, surfex_path):
        """

        """
        
        print('Extraction des données climatiques')
        self.cells_list = False
        self.surfex_path = surfex_path
    
    
    def update_reanalysis(self):
        
        # https://meteo.data.gouv.fr/datasets/6569b27598256cc583c917a7
        # Download last file : URL stable
        url_meteo = 'https://www.data.gouv.fr/fr/datasets/r/adcca99a-6db0-495a-869f-40c888174a57'
        last_file = "last_file"

        # Read surfex mesh at the Brittany regional-scale
        mesh = gpd.read_file(os.path.join(self.surfex_path, 'shapefile', 'mesh_bzh.shp'))

        # Convert Lambert II étendu to Lambert 93
        transformer = Transformer.from_crs("EPSG:27572", "EPSG:2154")

        # Target variables
        parameters = ['LAMBX', 'LAMBY', 'DATE', 'T_Q', 'PRELIQ_Q', 'ETP_Q', 'DRAINC_Q', 'RUNC_Q']

        # Requests the URL
        response = requests.get(url_meteo)

        if response.status_code == 200:
            
            # Unzipped file
            with gzip.open(BytesIO(response.content), 'rt') as f:
               
                # Read csv file
                df = pd.read_csv(f, sep=";", usecols=parameters)
                
                # Filter CSV file with the Brittany meshes
                df['LON_L93'], df['LAT_L93'] = transformer.transform(df['LAMBX'].values*100, df['LAMBY'].values*100)
                gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df['LON_L93'], df['LAT_L93']))#, sim_mesh['LAT_L93']))
                gdf.crs = mesh.crs
                joined = gpd.sjoin(gdf, mesh, op='within')
                cells_list = np.unique(joined['num_id'])
                
                parameters.append('geometry')
                parameters.append('num_id')
                
                joined = joined[parameters]
                joined = joined.set_index(['num_id'], drop=True)
                joined['DATE']= pd.to_datetime(joined["DATE"].values, format='%Y%m%d').values
                
                # Modify the file format
                downloaded_data = {}
                for serie_temporelle in ['T_Q', 'PRELIQ_Q', 'ETP_Q', 'DRAINC_Q', 'RUNC_Q']:
                    serie_temporelle_df = joined.groupby(['DATE', 'num_id'])[serie_temporelle].first().unstack()
                    downloaded_data[serie_temporelle] = serie_temporelle_df
                    
            # Load reanalysis h5 file
            filename = os.path.join(self.surfex_path, 'reanalysis.h5')
            with open(filename, 'rb') as f:
                reanalysis =  pickle.load(f)
                
            last_value = reanalysis['PRELIQ_Q'].index[-1]
            start_date = last_value + pd.Timedelta(days=1)
            filtered_data = {key: value[value.index >= start_date] for key, value in downloaded_data.items()}
            
            # Group h5 files            
            new_reanalysis = {}
            
            for var in reanalysis.keys():
                new_reanalysis[var] = pd.concat([reanalysis[var], filtered_data[var]])
            
            # Save Reanalysis h5 file
            save_object(new_reanalysis, self.surfex_path, 'reanalysis.h5')

        else:
            print("Erreur lors du téléchargement du fichier.")
            

    def update_watershed_data(self, surfex_path, watershed_shp):

        # Load h5 file
        filename = os.path.join(surfex_path, 'reanalysis.h5')
        with open(filename, 'rb') as f:
            data =  pickle.load(f)

        # Extract cells from shapefile
        if not self.cells_list:
            self.extract_cells_from_shapefile(surfex_path, watershed_shp)

        # Extract values from h5 file
        self.extract_values_from_h5file(h5file=data)

        # Store climatic variables
        self.store_variables()


    def extract_cells_from_shapefile(self, surfex_path, watershed_shp):
        """
        
        Extract cells

        Parameters
        ----------
        surfex_path : TYPE
            DESCRIPTION.
        watershed_shp : TYPE
            DESCRIPTION.

        Returns
        -------
        None.

        """
        
        mesh_path = os.path.join(surfex_path, 'shapefile', 'mesh_bzh.shp')
        #mesh_path = surfex_path + '/shapefile/maille_meteo_fr_pr93.shp'
        mask = watershed_shp
        #mask = gpd.read_file(watershed_shp , encoding="utf-8")
        mesh = gpd.read_file(mesh_path, encoding="utf-8") 
        mask.crs = 'EPSG:2154'
        intersect = gpd.clip(mesh, mask)
        self.cells_list = intersect.num_id.to_list() # wanted Surfex cells list


    def extract_values_from_h5file(self, h5file):

        variables = ['DRAINC_Q','RUNC_Q', 'ETP_Q', 'PRELIQ_Q', 'T_Q']

        self.values = {}

        for var in variables:

            self.values[var] = {}
               
            try:
                values = h5file[var]
                values = values[values.columns.intersection(self.cells_list)]
                values['MEAN'] = values.mean(numeric_only=True, axis=1)
                self.values[var] = values
            except:
                # print('None: '+sim)
                pass


    def store_variables(self):

        # -- recharge (mm/d > m/s)
        self.recharge = pd.DataFrame(self.values['DRAINC_Q'].MEAN / (1000*86400))
        self.recharge.columns = ['Q']
        self.recharge.index.name = 't'
        self.recharge.index = pd.DatetimeIndex(self.recharge.index)
        self.recharge['Q'] = np.float64(self.recharge['Q'])
        
        # -- runoff (mm/d > m/s)
        self.runoff = pd.DataFrame(self.values['RUNC_Q'].MEAN / (1000*86400))
        self.runoff.columns = ['Q']
        self.runoff.index.name = 't'
        self.runoff.index = pd.DatetimeIndex(self.runoff.index)
        self.runoff['Q'] = np.float64(self.runoff['Q'])
        
        # -- precipitation (mm/d)
        self.precipitation = pd.DataFrame(self.values['PRELIQ_Q'].MEAN)
        self.precipitation.columns = ['Q']
        self.precipitation.index.name = 't'
        self.precipitation.index = pd.DatetimeIndex(self.precipitation.index)
        self.precipitation['Q'] = np.float64(self.precipitation['Q'])
        
        # -- evapotranspiration (mm/d)
        self.etp = pd.DataFrame(self.values['ETP_Q'].MEAN)
        self.etp.columns = ['Q']
        self.etp.index.name = 't'
        self.etp.index = pd.DatetimeIndex(self.etp.index)
        self.etp['Q'] = np.float64(self.etp['Q'])
        
        # -- air temperature (°C)
        self.temperature = pd.DataFrame(self.values['T_Q'].MEAN)
        self.temperature.columns = ['Q']
        self.temperature.index.name = 't'
        self.temperature.index = pd.DatetimeIndex(self.temperature.index)
        self.temperature['Q'] = np.float64(self.temperature['Q'])