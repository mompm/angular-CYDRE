# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette
"""

# Python modules
import os
import sys
import time
import pandas as pd
import geopandas as gpd

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.forecast.initialization as IN
import libraries.forecast.outputs as OU
import libraries.forecast.evaluation as EV
import utils.toolbox as toolbox

start = time.time()


#%% PREPARATION

# Cydre results path
output_path = "C:/Users/nicol/OneDrive - Université de Rennes/IR_CYDRE/figures/Projections"

# Load the CSV file containing information about hydrological stations,
# including national identifier, river name and coordinates.
stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
piezo_stations = gpd.read_file(os.path.join(app_root, 'data', 'piezometry', 'stations.shp'))

# Initialize Cydre application, loading input parameters, datasets, etc.
init = IN.Initialization(app_root)
cydre_app = init.cydre_initialization()

 # Watershed identifier
watershed_id = cydre_app.UserConfiguration.user_watershed_id
watershed_name = stations[stations['ID'] == watershed_id].name.values[0]


#%% CYDRE APPLICATION

# Run the Cydre application
cydre_app.run_spatial_similarity(spatial=True)
cydre_app.run_timeseries_similarity()
cydre_app.select_scenarios(spatial=True)
df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast()


#%% VISUALIZATION AND RESULTS STORAGE
baseflow_option = False
results = OU.Outputs(cydre_app, output_path, watershed_name, stations, cydre_app.date, log=True,
                     module=True, baseflow=baseflow_option, options='viz_plotly')
toolbox.save_object(results, os.path.join(output_path, watershed_name, cydre_app.date.strftime('%Y-%m-%d')), f'results_{watershed_name}')


#%% MODEL EVALUATION (ONLY FOR TEST MODE > COMPARISON WITH OBSERVATION ONLY IN THE PAST)

if cydre_app.version == 'test': 
    
    model_quality = {'streamflow': {}, 'volume': {}, 'storage': {}}
    if baseflow_option:
        model_quality['baseflow'] = {}
    targets = ['Q10', 'Q50', 'Q90', 'Qmean']
    
    for target in targets:
        
        # Daily streamflow
        obs = results.user_streamflow_forecast['Q'].values
        sim = df_streamflow_forecast[target].values
        Metrics = EV.Evaluation(sim, obs)
        model_quality['streamflow'][target] = Metrics.model_performance()
        
        # Volume
        obs = results.volume_user['Q'].values
        sim = results.volume_proj[target].values
        Metrics = EV.Evaluation(sim, obs)
        model_quality['volume'][target] = Metrics.model_performance()
        
        # Storage variations
        obs = results.storage_user['Q'].values
        sim = results.storage_proj[target].values
        Metrics = EV.Evaluation(sim, obs)
        model_quality['storage'][target] = Metrics.model_performance()
        
        # Baseflow
        if baseflow_option:
            obs = results.Q_baseflow.values
            sim = df_streamflow_forecast[target].values
            Metrics = EV.Evaluation(sim, obs)
            model_quality['baseflow'][target] = Metrics.model_performance()
    
    # Dictionnary to dataframe
    for variable in model_quality.keys():
        dfs = [model_quality[variable][key] for key in model_quality[variable].keys()]
        model_quality[variable] = pd.concat(dfs, keys=model_quality[variable].keys())
        model_quality[variable].reset_index(inplace=True, level=1, drop=True)
        
    results.save_performance(model_quality)

#%% TEST PURPOSE
results_test = OU.Outputs(cydre_app, output_path, watershed_name, stations, cydre_app.date, log=True, module=True, baseflow=False,
                          options='viz_matplotlib')

#%%
end = time.time()
print(end-start)
