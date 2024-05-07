# -*- coding: utf-8 -*-
"""
Created on Wed Jul  5 15:01:20 2023

@author: Nicolas Cornette
"""

# Modules
import os

# Cydre modules
import utils.toolbox as toolbox


class HistoricalData():
    
    def __init__(self, path, filename):
        
        # Arguments
        self.filename = filename
        self.path = path
    
        # Check if the historical data file exists
        success = os.path.exists(os.path.join(self.path, self.filename))
        
        if success:
            # if success, loading the regional historical database
            self.data = self.load_data()
        
    
    def create_data(self):
        print("Updating the regional historical database")
        pass

    def load_data(self):
        data = toolbox.load_object(self.path, self.filename)
        return data
    
    def save_data(self, data):
        print("Saving the regional historical database")
        toolbox.save_object(data, self.path, self.filename)
        
    def remove_watersheds(self, data, watershed_id):
        for ws in watershed_id:
            data.pop(ws)
        return data
        