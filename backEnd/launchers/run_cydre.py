# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette

Launcher principal pour l'application dans une utilisation standalone python

"""

# Python modules
import time

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.forecast.initialization as IN
import libraries.forecast.outputs as OU
from libraries.load_data import define_paths, load_data

start = time.time()


#%% PREPARATION
(data_path, hydrometry_path, surfex_path, piezo_path, hydraulic_path, output_path) = define_paths(app_root)
gdf_stations, gdf_piezometry, gdf_watersheds = load_data(app_root)


#%% CYDRE APPLICATION
 # Initialize the Cydre application
init = IN.Initialization(app_root, gdf_stations)
cydre_app = init.cydre_initialization()

# Run the Cydre application
cydre_app.run_spatial_similarity(hydraulic_path) 
cydre_app.run_timeseries_similarity(data_path, cydre_app.Similarity.similar_watersheds)
cydre_app.select_scenarios(cydre_app.Similarity.correlation_matrix)
df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast(data_path)


#%% VISUALIZATION AND RESULTS STORAGE
watershed_name = cydre_app.UserConfiguration.user_watershed_name
initial_date = init.params.getgroup("General").getparam("date").getvalue()

results = OU.Outputs(cydre_app, output_path, watershed_name, gdf_stations, initial_date, log=True,
                     module=True, baseflow=False, options='viz_plotly')

results.plot_typology_map(gdf_stations, gdf_watersheds, cydre_app.UserConfiguration.user_watershed_id)


#%%
end = time.time()
print(end-start)