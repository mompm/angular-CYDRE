# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette

Launcher principal pour l'application dans une utilisation standalone python

"""
import sys
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

# Define paths
data_path = os.path.join(app_root, 'data')
hydraulic_path = os.path.join(data_path, 'hydraulicprop')
output_path = os.path.join(app_root, 'outputs', 'projections')

# Load hydrological stations
#NICOLAS: à intégrer dans Initialization
stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')

#%% CYDRE APPLICATION

 # Initialize the Cydre application
init = IN.Initialization(app_root, stations)
cydre_app = init.cydre_initialization()

# Run the Cydre application
cydre_app.run_spatial_similarity(hydraulic_path) 
cydre_app.run_timeseries_similarity(data_path, cydre_app.Similarity.similar_watersheds)
cydre_app.select_scenarios(cydre_app.Similarity.correlation_matrix)
df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast(data_path)


#%% VISUALIZATION AND RESULTS STORAGE
# Change of coordinate system for compatibility maps
# Everything is in the code in WGS84
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

# Load watersheds boundaries (already in WGS84) - Should be done once for the stations
gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')

watershed_name = cydre_app.UserConfiguration.user_watershed_name
initial_date = init.params.getgroup("General").getparam("date").getvalue()

results = OU.Outputs(cydre_app, output_path, watershed_name, stations, initial_date, log=True,
                     module=True, baseflow=False, options='viz_plotly')

results.plot_typology_map(gdf_stations, gdf_watersheds, cydre_app.UserConfiguration.user_watershed_id)

#%%
end = time.time()
print(end-start)
