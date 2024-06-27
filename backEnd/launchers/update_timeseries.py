# -*- coding: utf-8 -*-
"""
Created on Wed Jun  7 17:30:16 2023

@author: nicol
"""

# Python modules
import os
import sys

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import utils.toolbox as toolbox
import libraries.preprocessing.data.surfex as surfex
import libraries.preprocessing.data.hydrometry as hydrometry
import libraries.preprocessing.data.piezometry as piezometry



#%% path definitions (tmp)
# Intermediary outputs (formatted database)
out_path = os.path.join(app_root, "outputs")
surfex_path = os.path.join(app_root, 'data', 'climatic', 'surfex')
hydro_path = os.path.join(app_root, 'data', 'hydrometry')
piezo_path = os.path.join(app_root, 'data', 'piezometry')
sys.exit()
test = surfex.Surfex(surfex_path)
test.update_reanalysis()

#%% Update the new data structure

# Load datasets
watersheds = toolbox.load_object(out_path, 'data.pkl')

# Climatic data : updating the reanalysis
for ws in watersheds.keys():
    
    try:
        test = surfex.Surfex(surfex_path)
        test.update_watershed_data(surfex_path, watersheds[ws]["geographic"]["geometry"])
        
        if not 'climatic' in watersheds:
            watersheds[ws]['climatic'] = {}
            
        watersheds[ws]['climatic']['cells_list'] = test.cells_list
        watersheds[ws]['climatic']['values'] = test.values
        watersheds[ws]['climatic']['recharge'] = test.recharge
        watersheds[ws]['climatic']['runoff'] = test.runoff
        watersheds[ws]['climatic']['precipitation'] = test.precipitation
        watersheds[ws]['climatic']['etp'] = test.etp
        watersheds[ws]['climatic']['temperature'] = test.temperature
        
        test.recharge.to_csv(os.path.join(surfex_path, 'recharge', ws+'.csv'))
        test.runoff.to_csv(os.path.join(surfex_path, 'runoff', ws+'.csv'))
        test.precipitation.to_csv(os.path.join(surfex_path, 'precipitation', ws+'.csv'))
        test.etp.to_csv(os.path.join(surfex_path, 'etp', ws+'.csv'))
        test.temperature.to_csv(os.path.join(surfex_path, 'temperature', ws+'.csv'))
    except:
        print(f"Error with {ws}")


# Hydrometric data
for ws in watersheds.keys():    
    try:
        test2 = hydrometry.Hydrometry(bh_id = ws)
        
        if not 'hydrometry' in watersheds:
            watersheds[ws]['hydrometry'] = {}
        
        watersheds[ws]['hydrometry']['name'] = test2.name
        watersheds[ws]['hydrometry']['area'] = test2.area
        watersheds[ws]['hydrometry']['station_sheet'] = test2.station_sheet
        watersheds[ws]['hydrometry']['outlet'] = test2.outlet
        watersheds[ws]['hydrometry']['discharge'] = test2.discharge
        watersheds[ws]['hydrometry']['specific_discharge'] = test2.specific_discharge
        
        test2.discharge.to_csv(os.path.join(hydro_path, 'discharge', ws+'.csv'))
        test2.specific_discharge.to_csv(os.path.join(hydro_path, 'specific_discharge', ws+'.csv'))
        
        print(ws, ':' ,watersheds[ws]['hydrometry']['discharge'].index[-1])
    except:
        print(f"Error with {ws}")
        

# Piezometric data
for ws in watersheds.keys():
    try:
        test3 = piezometry.Piezometry(ws, piezo_path)
        
        if not 'piezometry' in watersheds:
            watersheds[ws]['piezometry'] = {}
        
        watersheds[ws]['piezometry']['watershed_id'] = test3.watershed_id
        watersheds[ws]['piezometry']['data_path'] = test3.data_path
        watersheds[ws]['piezometry']['table'] = test3.table
        watersheds[ws]['piezometry']['bss_id'] = test3.bss_id
        watersheds[ws]['piezometry']['old_bss_id'] = test3.old_bss_id
        watersheds[ws]['piezometry']['data'] = test3.data
        watersheds[ws]['piezometry']['water_table_level'] = test3.water_table_level
        watersheds[ws]['piezometry']['water_table_depth'] = test3.water_table_depth
        
        test3.data.to_csv(os.path.join(piezo_path, test3.bss_id+'.csv'))
        
        print(ws, ':' ,watersheds[ws]['piezometry']['water_table_depth'].index[-1])
    except:
        print(f"Error with {ws}")
        
#%% Test
count = 0
for ws in watersheds.keys():
    #print(ws, ':' ,watersheds[ws]['hydrometry']['discharge'].index[-1])
    #print(ws, ':' ,watersheds[ws]['climatic']['temperature'].index[-1])
    #print(watersheds[ws]['climatic']['temperature'].iloc[-1].values[0])
    try:
        print(ws, ':' ,watersheds[ws]['piezometry']['water_table_depth'].index[-1])
        count = count + 1
    except:
        pass

#%% Save regional object
toolbox.save_object(watersheds, out_path, 'data.pkl')

