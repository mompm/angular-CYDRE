# -*- coding: utf-8 -*-
"""
Created on Mon Jun  3 11:08:15 2024

@author: nicol
"""

# Python modules
import os
import sys
import numpy as np
import pandas as pd

import seaborn as sns
import matplotlib.pyplot as plt

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()
import libraries.utils.toolbox as toolbox
from libraries.load_data import define_paths, load_data


# Load the CSV file containing information about hydrological stations,
# including national identifier, river name and coordinates.
(data_path, _, _, _, hydraulic_path, _) = define_paths(app_root)
gdf_stations, _, _ = load_data(app_root)


# Sensitivity analysis folder and watersheds
SA_folder = os.path.join(app_root, "outputs", "projections", "sensitivity_analysis", "_2024_07_25_143348")
all_files = os.listdir(SA_folder)
watersheds_id = [file for file in all_files if file != 'cydre_params.xml']
watersheds_name = gdf_stations[gdf_stations['ID'].isin(watersheds_id)].station_name.values

sys.exit()
#%% Performance

df_perf = pd.DataFrame()
names = []


for watershed in watersheds_id:
        path = os.path.join(SA_folder, watershed)
        watershed_files = os.listdir(path)
        dates = [entry for entry in watershed_files if os.path.isdir(os.path.join(path, entry))]
        
        watershed_name = gdf_stations[gdf_stations["ID"] == watershed].name.values[0]
        names.append(gdf_stations[gdf_stations["ID"] == watershed].station_name.values[0])
        filename = f"results_{watershed_name}"
        
        #date = dates[0]
        t = []
        coeff_max = []
        
        for date in dates:
            try:
                data_test = toolbox.load_object(os.path.join(path, date), filename)
                
                obs = data_test.user_streamflow_forecast['Q'].values
                min_sim = np.nanpercentile(data_test.streamflow_proj_series, 10, axis=0)
                max_sim = np.nanpercentile(data_test.streamflow_proj_series, 90, axis=0)

                
                logical_test = np.logical_and(obs >= min_sim, obs <= max_sim)
                prop_test = np.mean(logical_test)
                
                t.append(date)
                coeff_max.append(prop_test)
            except:
                print(date)
                pass
        
        tmp_df = pd.DataFrame([coeff_max], columns=t)
        df_perf = pd.concat([df_perf, tmp_df])
    
df_perf.index = names

# Seaborn heatmap
plt.figure(figsize=(10, 3))
sns.heatmap(df_perf, cmap='coolwarm', linewidths=.8, vmin=0, vmax=np.nanmax(df_perf))#, annot=False, fmt=".3f", linewidths=.5)
plt.savefig(os.path.join(SA_folder, 'heatmap_performance.tiff'), dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"}, bbox_inches='tight', pad_inches=0.1)
plt.show()