# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette

Launcher principal pour l'application dans une utilisation standalone python

"""

# Python modules
import time
import sys

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.forecast.initialization as IN
import libraries.postprocessing.outputs as OU
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
cydre_app.run_spatial_similarity(hydraulic_path, gdf_stations) 
cydre_app.run_timeseries_similarity(data_path, cydre_app.Similarity.similar_watersheds)
cydre_app.select_scenarios(cydre_app.Similarity.correlation_matrix)
df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast(data_path)

sys.exit()
#%% VISUALIZATION AND RESULTS STORAGE
watershed_name = cydre_app.UserConfiguration.user_watershed_name
initial_date = init.params.getgroup("General").getparam("date").getvalue()

results = OU.Outputs(cydre_app, watershed_name, gdf_stations, initial_date, cydre_app.Similarity.user_similarity_period,
                     log=True, module=True, options='viz_plotly')
results.store_results(output_path, cydre_app.scenarios, cydre_app.Similarity.watershed_similarity,
                      cydre_app.Similarity.similar_watersheds, log=True, fig_format='tiff')
results.plot_streamflow_projections(log=True, module=True, stats_stations=True, options='viz_matplotlib')
results.plot_watersheds(gdf_watersheds, cydre_app.Similarity.similar_watersheds)
results.plot_typology_map(gdf_stations, gdf_watersheds, cydre_app.UserConfiguration.user_watershed_id, cydre_app.Similarity.clusters)
#results.seasonal_hydrograph([cydre_app.UserConfiguration.user_watershed_id, 'J0014010'], hydrometry_path)
results.seasonal_hydrograph(cydre_app.Similarity.similar_watersheds, hydrometry_path)
results.plot_streamflow_projections_test(log=True, module=True, stats_stations=True, options='viz_plotly')

#%%
end = time.time()
print(end-start)