# -*- coding: utf-8 -*-
"""
Created on Wed Jun 14 15:20:32 2023

@author: Nicolas Cornette

Configutation of the watershed used for the projection
- Parameter Management
- Data loalding for hdyrographic stations for the watershed on which projections are demanded
"""

from flask import jsonify
import pandas as pd
import os


class UserConfiguration():
    """
        Configutation of the watershed used for the projection
    """
    
    def __init__(self, params, stations):
        """
        Parameters
        ----------
        params : results of xml reader in specific class 
            Parameters of the simulation (User_Configuration)
        stations : 
            List of all stations and characteristics
        """
        
        # Store the hydrological station identifier and characteristics
        self.params = params
        self.user_watershed_id = self.params.getparam("user_watershed_id").getvalue()
        self.user_watershed_name = stations[stations['ID'] == self.user_watershed_id]['station_name'].values[0]
        self.user_bss_id = stations[stations['ID'] == self.user_watershed_id]['BSS_ID'].values[0]
        self.user_watershed_area = stations[stations['ID'] == self.user_watershed_id]['area'].values[0]
        # Number of days on which projection should be completed
        self.user_horizon = self.params.getparam("user_horizon").getvalue()


    def serialize_params(self):
        """
        For web application, gets some of the elements of the class
        - watershed_id
        - user_horizon
        """
        return jsonify({"user_watershed_id":self.user_watershed_id,"user_horizon":self.user_horizon})
                
        
    #NICOLAS: supprimer cette fonction au profit de la suivante
    def select_user_watershed(self, data_path):
        """
        Gets the time series of the data

        """
        try:
        #if self.user_watershed_id in watersheds:
            #self.user_watershed = watersheds[self.user_watershed_id]
            self.extract_user_timeseries(data_path)
        except:
            raise ValueError("The prediction watershed does not exist in the historical database.")
    
    
    def extract_user_timeseries(self, data_path):
        """
        Gets the time series from stored files (HydroPortail)
        of the data (streamflow, runoff, recharge, storage)
        """
        
        # Extract the user time series data
        self.user_streamflow = self.get_user_streamflow(data_path)
        self.user_recharge, self.user_runoff = self.get_user_inputs(data_path)        
        self.user_storage = self.user_recharge + self.user_runoff - self.user_streamflow       
        
        # Merge data in a dataframe
        self.user_df = pd.merge(self.user_streamflow, self.user_recharge, left_index=True, right_index=True, suffixes=('_streamflow', '_recharge'))
        self.user_df = pd.merge(self.user_df, self.user_runoff, left_index=True, right_index=True, suffixes=('', '_runoff'))
        self.user_df = pd.merge(self.user_df, self.user_storage, left_index=True, right_index=True, suffixes=('_runoff', '_storage'))
         
            
    def extract_initial_flows(self, date):
        
        # Extract the initial flow at J-1 for aligning historical chronicles used for the projections.
        user_Qi = self.user_df[self.user_df.index == date]

        return user_Qi
    
    
    def get_user_streamflow(self, data_path):
        streamflow_path = os.path.join(data_path, "hydrometry", "specific_discharge", "{}.csv".format(self.user_watershed_id)) 
        with open(streamflow_path) as file:
            streamflow = pd.read_csv(file, index_col="t")
            streamflow.index = pd.to_datetime(streamflow.index)

        return streamflow


    def get_user_inputs(self, data_path):
        recharge_path = os.path.join(data_path, "climatic", "surfex", "recharge", "{}.csv".format(self.user_watershed_id)) 
        with open(recharge_path) as file:
            recharge = pd.read_csv(file, index_col="t")
            recharge.index = pd.to_datetime(recharge.index)
        
        runoff_path = os.path.join(data_path, "climatic", "surfex", "runoff", "{}.csv".format(self.user_watershed_id)) 
        with open(runoff_path) as file:
            runoff = pd.read_csv(file, index_col="t")
            runoff.index = pd.to_datetime(runoff.index)
        
        return recharge, runoff 