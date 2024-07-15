# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 17:36:47 2023

@author: Nicolas Cornette
"""

# Modules
import sys
import os
import pickle

# Cydre modules
import utils.toolbox as toolbox
import libraries.preprocessing.geographic as geographic
import libraries.preprocessing.data.surfex as surfex
import libraries.preprocessing.data.hydrometry as hydrometry
import libraries.preprocessing.data.hydraulicprop as hydraulicprop
import libraries.preprocessing.data.geology as geology
import libraries.preprocessing.data.piezometry as piezometry
import libraries.forecast.variables as VAR


class Watershed():
    """
    Class managing data at the watershed scale.
    """
    
    def __init__(self, watershed_id: str, dem_path: str,
                 out_path: str, stations_file: str,
                 save_object: bool = True, load_object: bool = False):
        
        # Regional inputs
        stations_file = stations_file
        dem_path = dem_path
        out_path = out_path
        
        # Watershed national identifier (using hydrological station ID from HydroPortail)
        self.watershed_id = watershed_id
        
        # Path where watershed data will be stored        
        self.watershed_folder = os.path.join(out_path, watershed_id)
        toolbox.create_folder(self.watershed_folder)
        self.elt_def = []
        
        success = False
        
        # Load or create watershed object
        if load_object==True:
             # Load from previously stored (saved) watershed
             success = self.load_object()
             print("Object was loaded successfully")
        else: 
             print("Object was not loaded as demanded but created from scratch")
             
        if load_object==False or success==False: 
            print("Create new object, will removed previousy stored object at the same place")
            
            # Definition of the watershed
            x_outlet, y_outlet, snap_dist = self.define_watershed_charac(stations_file)
            
            # Creation of the watershed defined at the previous line
            self.create_object(dem_path, x_outlet, y_outlet, snap_dist, out_path)
            
            # Save object
            if save_object == True:
                self.save_object()

#%% PYTHON OBJECT
                
    def define_watershed_charac(self, stations_file):
        try:
            # Finds the watershed within the list
            watershed_info = stations_file.loc[stations_file['ID'] == self.watershed_id]
            self.watershed_name = watershed_info.iloc[0]['name']
            x_outlet = watershed_info.iloc[0]['x_outlet']
            y_outlet = watershed_info.iloc[0]['y_outlet']
            #snap_dist = watershed_info.iloc[0]['snap_dist']
            snap_dist=150
        
        except:
            print("Warning : The name of watershed is not in the watershed list or watershed list does not exist")
            sys.exit()
            
        return x_outlet, y_outlet, snap_dist
        
        
    def load_object(self):
        
        if os.path.exists(os.path.join(self.watershed_folder, 'python_object')):
            
            with open(os.path.join(self.watershed_folder, 'python_object'), 'rb') as config_dictionary_file:
              BV = pickle.load(config_dictionary_file)
              
              # At least geographic should have been stored
              if ('geographic' in BV.__dir__()) == True:
                  self.geographic = BV.geographic
                  self.elt_def.append('geographic')
                  
              if ('geology' in BV.__dir__()) == True:
                  self.geology = BV.geology
                  self.elt_def.append('geology')
                  
              if ('piezometry' in BV.__dir__()) == True:
                  self.piezometry = BV.piezometry
                  self.elt_def.append('piezometry')
                  
              if ('hydrometry' in BV.__dir__()) == True:
                  self.hydrometry = BV.hydrometry
                  self.elt_def.append('hydrometry')
                  
              if ('climatic' in BV.__dir__()) == True:
                  self.climatic = BV.climatic
                  self.elt_def.append('climatic')
                  
              if ('hydraulicprop' in BV.__dir__()) == True:
                  self.hydraulicprop = BV.hydraulicprop
                  self.elt_def.append('hydraulicprop')
        else:
            print("Warning : file doesn't exist, python_object", self.watershed_folder)
            return False
        
    
    def create_object(self, dem_path, x_outlet, y_outlet, snap_dist, out_path):
        
        # Create watershed object with watershed delineation
        self.geographic = geographic.Geographic(dem_path=dem_path,
                                                x_outlet=x_outlet,
                                                y_outlet=y_outlet,
                                                snap_dist=snap_dist,
                                                regional_out_path = out_path,
                                                watershed_out_path=self.watershed_folder,
                                                buff_percent=500)
        
        self.elt_def.append('geographic')
        
        
    def save_object(self):
        toolbox.save_object(self, self.watershed_folder, 'python_object')
       
        
#%% DATA OBJECT
    
    def add_geographic(self, dem_path, x_outlet, y_outlet, snap_dist, out_path):
        # Structure data
        self.geographic = geographic.Geographic(dem_path=dem_path,
                                                x_outlet=x_outlet,
                                                y_outlet=y_outlet,
                                                snap_dist=snap_dist,
                                                regional_out_path = out_path,
                                                watershed_out_path=self.watershed_folder,
                                                buff_percent=500)
        self.elt_def.append('geographic')
        self.save_object()
        
        
    def add_hydrometry(self):
        self.hydrometry = hydrometry.Hydrometry(bh_id = self.watershed_id)
        self.elt_def.append('hydrometry')
        self.save_object()

    
    def add_surfex(self, surfex_path):
        surfex_path = surfex_path
        self.climatic = surfex.Surfex(out_path=self.watershed_folder,
                                      surfex_path=surfex_path,
                                      watershed_shp=self.geographic.watershed_shp)
        self.elt_def.append('surfex')
        self.save_object()
    
        
    def add_hydraulicprop(self, hydraulicprop_path):
        self.hydraulicprop = hydraulicprop.HydraulicProp(self.watershed_id,
                                                         hydraulicprop_path)
        self.elt_def.append('hydraulicprop')
        self.save_object()
        
        
    def add_geology(self, geology_path):
        self.geology = geology.Geology(self.watershed_id,
                                       geology_path)
        self.elt_def.append('geology')
        self.save_object()
        
        
    def add_piezometry(self, piezometry_path):
        self.piezometry = piezometry.Piezometry(self.watershed_id,
                                                piezometry_path)
        self.elt_def.append('piezometry')
        self.save_object()
        
        
#%% FILTER OBJECT

    def get_variable(self, obj, variable):
        test = VAR.Variables()
        variable_type = test.get_variable_type(variable)
        variable_type_obj = getattr(obj, variable_type)
        return getattr(variable_type_obj, variable)