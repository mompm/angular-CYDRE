# -*- coding: utf-8 -*-
"""
Created on Wed Jun 14 15:20:32 2023

@author: Nicolas Cornette
"""

import pandas as pd


class UserConfiguration():
    
    
    def __init__(self, params):
        """
        DESCRIPTION.

        Parameters
        ----------
        user_site : TYPE
            DESCRIPTION.
        historical_database : TYPE
            DESCRIPTION.

        Returns
        -------
        None.

        """
        
        # Store the hydrological station identifier
        self.params = params
        self.user_watershed_id = self.params.getparam("user_watershed_id").getvalue()
        self.user_horizon = self.params.getparam("user_horizon").getvalue()
                
        
    def select_user_watershed(self, watersheds):
        """
        

        Parameters
        ----------

        Returns
        -------
        dict
            DESCRIPTION.

        """
        if self.user_watershed_id in watersheds:
            self.user_watershed = watersheds[self.user_watershed_id]
            self.extract_user_timeseries(watersheds)
        else:
            raise ValueError("The prediction watershed does not exist in the historical database.")
    
    
    def extract_user_timeseries(self, watersheds):
        
        # Extract the user time series data
        self.user_streamflow = self.get_user_streamflow(watersheds)
        self.user_recharge, self.user_runoff = self.get_user_inputs(watersheds)        
        self.user_storage = self.user_recharge + self.user_runoff - self.user_streamflow       
        
        # Merge data in a dataframe
        self.user_df = pd.merge(self.user_streamflow, self.user_recharge, left_index=True, right_index=True, suffixes=('_streamflow', '_recharge'))
        self.user_df = pd.merge(self.user_df, self.user_runoff, left_index=True, right_index=True, suffixes=('', '_runoff'))
        self.user_df = pd.merge(self.user_df, self.user_storage, left_index=True, right_index=True, suffixes=('_runoff', '_storage'))
         
            
    def extract_initial_flows(self, date):
        
        # Extract the initial flow at J-1 for aligning historical chronicles used for the projections.
        user_Qi = self.user_df[self.user_df.index == date]

        return user_Qi
    
    
    def get_user_streamflow(self, watersheds):
        df = watersheds[self.user_watershed_id]['hydrometry']['specific_discharge']
        return df


    def get_user_inputs(self, watersheds):
        df_recharge = watersheds[self.user_watershed_id]['climatic']['recharge']
        df_runoff = watersheds[self.user_watershed_id]['climatic']['runoff']
        return df_recharge, df_runoff 