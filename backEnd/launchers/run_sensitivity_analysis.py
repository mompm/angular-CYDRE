# -*- coding: utf-8 -*-
"""
Created on Wed Oct 25 15:48:03 2023

@author: Nicolas Cornette
"""

# Python modules
import os
import sys
import time
import datetime
import shutil
import pandas as pd

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.forecast.initialization as IN
import libraries.forecast.outputs as OU
import libraries.forecast.sensitivity_analysis as SA
import libraries.forecast.evaluation as EV
import utils.toolbox as toolbox

start = time.time()


#%% PREPARATION

# Load the CSV file containing information about hydrological stations,
# including national identifier, river name and coordinates.
data_path = os.path.join(app_root, 'data')
stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')

# Initialize Cydre application, loading input parameters, datasets, etc.
init = IN.Initialization(app_root)
cydre_app = init.cydre_initialization()

# Create output path
#ndays = cydre_app.Similarity.params.getgroup("specific_discharge").getgroup("Time").getparam("ndays_before_forecast").getvalue()
current_date = datetime.datetime.now().strftime("%Y_%m_%d_%H%M%S")
#filename = f"_{current_date}_ndays{ndays}"
filename = f"_{current_date}"
output_path = os.path.join(app_root, 'outputs', 'projections', filename)
if not os.path.exists(output_path):
    os.makedirs(output_path)
xml_path = os.path.join(app_root, 'libraries', 'forecast', 'cydre_params.xml')
shutil.copy(xml_path, os.path.join(output_path, 'cydre_params.xml'))


#%% PARAMTERES DEFINITION

# - param_names : cydre parameter referenced in the XML configuration file.
# - param_ranges : parameters range, can be tuple (seq) or list (specified values).
# - num_values : n values if tuple; 1 if list
# param_names = ['forecast_horizon', 'ndays_before_forecast', 'indicator']
# param_ranges = [(7, 180), (7, 180), ['pearson']] # tuple in float case; list in string case
# num_values = [3, 3]
param_names = ['user_watershed_id', 'date']
#param_ranges = [['J0626610', 'J0014010', 'J2404010', 'J3834010', 'J7513010', 'J1524010'],
#                pd.date_range('2015-01-01', '2019-12-31', periods=25).tolist()]
param_ranges = [['J0626610', 'J0014010', 'J2404010', 'J3834010', 'J7513010', 'J1524010'], 
                pd.date_range('1980-05-01', '2024-05-01', freq='AS-MAY').tolist()]
num_values = [1, 1]


# Get parameter path
param_paths = init.get_parameters_path(param_names)

# Set parameters combination
sensitivity_analysis = SA.SensitivityAnalysis(param_names, param_ranges, num_values)
sensitivity_analysis.set_parameters_values()
param_combinations = sensitivity_analysis.set_parameters_combination()


#%% Sensitivity analysis

count = 1

for params in param_combinations:
    
    print(f'{count}/{len(param_combinations)}')
    
    try:
        # Update parameters
        for path in param_paths:
            param = path[-1]
            newvalue = params[param]
            exists1 = init.params.find_and_replace_param(path,newvalue)
        
        # Create cydre application with updated parameters
        cydre_app = init.create_cydre_app()
        watershed_name = stations[stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]
        
        # Run the Cydre application
        cydre_app.run_spatial_similarity(spatial=True)
        cydre_app.run_timeseries_similarity()
        cydre_app.select_scenarios(spatial=True)
        df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast()
        
        # VISUALIZATION AND RESULTS STORAGE
        baseflow_option = False
        results = OU.Outputs(cydre_app, output_path, watershed_name, stations, 
                             selected_date=str(params['date']).split(' ')[0], log=True, module=True, baseflow=baseflow_option)
        toolbox.save_object(results, os.path.join(output_path, 
                                                  cydre_app.UserConfiguration.user_watershed_id, params['date'].strftime('%Y-%m-%d')), f'results_{watershed_name}')
        
        # Model evaluation
        model_quality = {'streamflow': {}, 'volume': {}, 'storage': {}}
        if baseflow_option:
            model_quality['baseflow'] = {}
        
        targets = ['Q10', 'Q50', 'Q90', 'Qmean']
        
        for target in targets:
            
            # Daily streamflow
            obs = results.user_streamflow_forecast['Q'].values
            #sim = df_streamflow_forecast[target].values
            sim = results.streamflow_proj[target].values
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
        
    except:
        print(watershed_name)
        print(params['date'].strftime('%Y-%m-%d'))
        print(f'{count}/{len(param_combinations)} failed')
        pass
    # Increment counter
    count += 1
