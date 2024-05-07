# -*- coding: utf-8 -*-
"""
Created on Wed Jul  5 15:50:28 2023

@author: Nicolas Cornette
"""

# Cydre modules
from libraries.forecast import time_management as TI
import libraries.forecast.variables as VAR


class PreProcessor():
    
    """
    Class used for the preprocessing of time series data used for the similarity analysis.
    """
    
    def __init__(self, watershed, time_properties):
        
        # Watershed to be preprocessed
        self.watershed = watershed
        self.time_properties = time_properties
        
    
    def preprocess_watershed_data(self, variable):
        
        # Extract from the watershed object the datasets related to the variable
        #variable_data = self.watershed.get_variable(self.watershed, variable)
        variable_data = self.get_variable(self.watershed, variable)
        
        # Time series normalization
        df_norm = self._series_normalization(variable_data)
        
        # Time series smoothing by removing noise
        df_smooth = self._series_smoothing(df_norm)
        
        self.df = df_smooth
        # Subset the dataframe by selecting the period used for the similarity analysis
        #self.df = self.set_similarity_period(df_smooth, variable)
    
    
    def get_variable(self, data, variable):
        test = VAR.Variables()
        variable_type = test.get_variable_type(variable)
        #variable_type_obj = getattr(data, variable_type)
        return data[variable_type][variable]
    
    
    def _series_normalization(self, df):
        return (df - df.mean()) / df.std()
    
    
    def _series_smoothing(self, df):
        return df.rolling(window=1, min_periods=1).mean()
    
        
    def set_similarity_period(self, df, date, variable):
        
        # Convert to hydrological year
        df = self.time_properties.convert_to_HY(df)
        
        # Period to calculate similarity of time series
        df = self.time_properties.similarity_period(df, date)
        
        # Convert the dataframe based on the variable-specific time step
        df = self.time_properties.time_step_conversion(df, variable)
        
        return df