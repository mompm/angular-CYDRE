# -*- coding: utf-8 -*-
"""
Created on Wed Jun  7 17:30:16 2023

@author: Nicolas Cornette

Launchers for updating time series, i.e. csv of chronicles (piezo, flow, climate)
Should be launched automatically on server
Takes at least one hour
"""

# Python modules
import os
import sys
import pandas as pd
import geopandas as gpd

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.preprocessing.data.surfex as surfex
import libraries.preprocessing.data.hydrometry as hydrometry
import libraries.preprocessing.data.piezometry as piezometry


#%% Path Definitions
data_path = os.path.join(app_root, 'data')
surfex_path = os.path.join(app_root, 'data', 'climatic', 'surfex')
hydro_path = os.path.join(app_root, 'data', 'hydrometry')
piezo_path = os.path.join(app_root, 'data', 'piezometry')


#%% Load hydrological stations and watershed delineation 
hydro_stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
piezo_stations = pd.read_csv(os.path.join(piezo_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds2.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')


#%% Updating streamflow from HydroPortail using Hub'Eau API
for station_ID in hydro_stations['ID']:    
    try:
        # API
        Hydro = hydrometry.Hydrometry(bh_id = station_ID)
        
        # Export data        
        Hydro.discharge.to_csv(os.path.join(hydro_path, 'discharge', station_ID+'.csv'))
        Hydro.specific_discharge.to_csv(os.path.join(hydro_path, 'specific_discharge', station_ID+'.csv'))
        
        print(station_ID, ':' ,Hydro.discharge.index[-1])
    except:
        print(f"Error updating data for the hydrological station {station_ID}")


#%% Updating piezometric data from ADES using Hub'Eau API
for bss_ID in piezo_stations['Identifiant BSS']:
    try:
        # API
        Piezo = piezometry.Piezometry(bss_ID, piezo_path)
        Piezo.update_data(Piezo.old_bss_id)
        
        # Export data
        Piezo.data.to_csv(os.path.join(piezo_path, Piezo.bss_id+'.csv'))
        
        print(bss_ID, ':' ,Piezo.water_table_depth.index[-1])
    except:
        print(f"Error updating data for the piezometric station {bss_ID}")


#%% Updating climatic data from Météo-France using stable URL
# We need to update regional reanalysis h5 file first and then extract at the watershed-scale. 
Climatic = surfex.Surfex(surfex_path)
Climatic.update_reanalysis()

for station_ID in hydro_stations['ID']:
    try:
        Climatic = surfex.Surfex(surfex_path)
        watershed_geometry = gdf_watersheds[gdf_watersheds.index == station_ID]['geometry']
        Climatic.extract_watershed_scale(surfex_path, watershed_geometry)
        
        Climatic.recharge.to_csv(os.path.join(surfex_path, 'recharge', station_ID+'.csv'))
        Climatic.runoff.to_csv(os.path.join(surfex_path, 'runoff', station_ID+'.csv'))
        Climatic.precipitation.to_csv(os.path.join(surfex_path, 'precipitation', station_ID+'.csv'))
        Climatic.etp.to_csv(os.path.join(surfex_path, 'etp', station_ID+'.csv'))
        Climatic.temperature.to_csv(os.path.join(surfex_path, 'temperature', station_ID+'.csv'))
    except:
        print(f"Error updating data for the hydrological station {station_ID}")        
