# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette
"""

# Python modules
import os
import time
import pyproj
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.forecast.initialization as IN
import libraries.forecast.outputs as OU

start = time.time()


#%% PREPARATION

# Initialize Cydre application, loading input parameters, datasets, etc.
init = IN.Initialization(app_root)
cydre_app = init.cydre_initialization()
initial_date = init.params.getgroup("General").getparam("date").getvalue()
data_path = os.path.join(app_root, 'data')
hydro_path = os.path.join(data_path, 'hydrometry', 'discharge')
surfex_path = os.path.join(data_path, 'climatic', 'surfex')
piezo_path = os.path.join(data_path, 'piezometry')
#output_path = "C:/Users/nicol/OneDrive - Université de Rennes/IR_CYDRE/figures/Projections"
output_path = os.path.join(app_root, 'outputs', 'projections')

# Hydrological stations
stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

# Watersheds boundaries
gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')

# Piezometric stations
piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")

 # Watershed identifier
watershed_id = cydre_app.UserConfiguration.user_watershed_id
watershed_name = stations[stations['ID'] == watershed_id].station_name.values[0]


#%% CYDRE APPLICATION

# Run the Cydre application
cydre_app.run_spatial_similarity() 
cydre_app.run_timeseries_similarity(cydre_app.Similarity.similar_watersheds)
cydre_app.select_scenarios(cydre_app.Similarity.correlation_matrix)
df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast()


#%% VISUALIZATION AND RESULTS STORAGE
baseflow_option = False
results = OU.Outputs(cydre_app, output_path, watershed_name, stations, initial_date, log=True,
                     module=True, baseflow=baseflow_option, options='viz_plotly')

results.plot_typology_map(gdf_stations, gdf_watersheds, cydre_app.UserConfiguration.user_watershed_id)

#%%
end = time.time()
print(end-start)
