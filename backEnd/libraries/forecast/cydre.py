# -*- coding: utf-8 -*-
"""
Created on Wed May  3 10:27:18 2023

@author: Nicolas Cornette

Driver of the application for the hydrological projection
"""

# Modules
from numpy import NaN
import pandas as pd
from datetime import timedelta

# Cydre modules
from libraries.forecast import user_configuration as UC
from libraries.forecast import time_management as TI
from libraries.forecast import similarity as SIM
from libraries.forecast import selection as SE
from libraries.forecast import forecast


class Cydre():
    
    """
    Class used to run the seasonal forecast application.
    - On which watershes, at which date is made the projection
    
    Attributes
    ----------
    params : results from xml reader
        parameters xml (ALL).
    data_path : string
        Folder with all data.
    date : pandas date time
        date at which projection should be started
    UserConfiguration : instance of class UserCofiguration
        reference watershed: identifier, chronicles, intial flow (at the date of simulation)
    User_Qi : float
        initial flow for the reference watershed
    Similarity : instance of class Similarity 
        spatio-temporal similarities
    selected_scenarios: list of dataframes
        matrix of correlation per variable (one matrix per variable)
    scenarios: dataframe
        combination of previous matrices (weigted or not according to the correlation coefficient)
    scenarios_grouped: dataframe
        same as the previous one in a different format
    stats_station_forecast : dataframe
        statiscitics with only the data at the reference watershed
    
    """
    
    def __init__(self, stations, data_path, params, version):
        """  
        Parameters
        ----------
        stations : string
            File with all stations.
        params : results from xml reader
            parameters xml (ALL).
        version : TYPE
            #NICOLAS: à garder? à supprimer
        """
        
        # Store the Cydre application inputs parameters
        self.params = params
        self.version = version
        #NICOLAS: data_path ne semble pas être utilisé ailleurs que dans ce constructeur. 
        #         ne pas stocker comme attribut de la classe? 
        self.data_path = data_path
        # Configuration of the projection (date, position, duration of projection...)
        user_params = self.params.getgroup("UserConfig")
        
        # Create the User instance and select the watershed chosen by the user
        self.UserConfiguration = UC.UserConfiguration(user_params, stations)
        self.UserConfiguration.select_user_watershed(self.data_path)
        
        # Simulation date definition (includes possible modification of starting date because of precipitations)
        self.date = TI.TimeManagement.define_simulation_date(self.params, data_path, self.version,
                                                             self.UserConfiguration.user_watershed_id, self.UserConfiguration.user_bss_id)
        
        # Load initial flows
        self.user_Qi = self.UserConfiguration.extract_initial_flows(self.date)
        
        # Create the Similarity analysis instance
        similarity_params = self.params.getgroup("Similarity")
        self.Similarity = SIM.Similarity(similarity_params, self.date)
        
    
    def run_spatial_similarity(self, hydraulic_path, spatial=True):
        if spatial:
            self.Similarity.spatial_similarity(hydraulic_path)
            self.Similarity.get_similar_watersheds(self.UserConfiguration.user_watershed_id)
    
            
    def run_timeseries_similarity(self, data_path, similar_watersheds):
        self.Similarity.timeseries_similarity(data_path=data_path,
                                              user_watershed_id = self.UserConfiguration.user_watershed_id,
                                              similar_watersheds = similar_watersheds)
        
    def select_scenarios(self, corr_matrix={}):
        """
        Extract hydroclimatic events closest to the event to be forecast

        Parameters
        ----------
        corr_matrix : DataFrame
            Correlation matrix with:
                - rows : hydrological years
                - columns : watersheds

        Returns
        -------
        scenarios : DataFrame
            Hydroclimatic events closest to the event to be forecast.

        """

        # Initialization of the forecast scenarios dictionnary
        self.selected_scenarios = {}
        
        # Loop on timeseries variable
        for variable, correlation_matrix in corr_matrix.items():
            
            # Get selection parameters
            selection_params = self.Similarity.params.getgroup(variable).getgroup("Calculation")
            Selection = SE.Selection(selection_params)
            
            # Filter the correlation matrix with the similar watersheds and drop scenarios corresponding to the target year/watershed
            #if spatial:
             #   correlation_matrix = Selection.filter_with_similar_watersheds(correlation_matrix, self.Similarity.similar_watersheds)
            correlation_matrix = Selection.drop_target_scenarios(correlation_matrix, self.date.year, self.UserConfiguration.user_watershed_id)
            # correlation_matrix = Selection.filter_with_threshold(correlation_matrix)            
            
            # Store the variable scenarios (one matrix per variable)
            #NICOLAS: remplcer selected_scenarios par correlation_matrices
            self.selected_scenarios[variable] = correlation_matrix
        
        # Matrix combinations
        #NICOLAS: remplcer scenarios par correlation_matrix
        #NICOLAS: ajouter des poids à la sélection
        self.scenarios = Selection.matrix_combinations(self.selected_scenarios)
        # Ne garde dans la matrice de corrélation que les évènements à conserver, ceux qui ont été sélectionnés
        self.scenarios = Selection.filter_with_threshold(self.scenarios)
        
        # Group all scenarios in one dataframe
        self.scenarios_grouped = Selection.group_scenarios(self.scenarios)
        return self.scenarios_grouped, self.selected_scenarios , self.scenarios.replace(NaN, 0)
    
    
    def streamflow_forecast(self, data_path):

        # Create an instance of the Forecast class
        forecast_params = self.params.getgroup("UserConfig")
        self.Forecast = forecast.Forecast(forecast_params, self.date)
        
        # Extract timeseries data for the selected scenarios during the forecast period
        self.Forecast.from_scenarios_extract_timeseries(data_path, 
                                                        self.scenarios_grouped,
                                                        self.date,
                                                        self.user_Qi)
        
        # Projections using scenarios from spatio-temporal similarities
        try:
            self.df_streamflow_forecast = self.Forecast.timeseries_forecast(self.Forecast.Q_streamflow_forecast_normalized, weight=False)
            self.df_storage_forecast = self.Forecast.timeseries_forecast(self.Forecast.Q_storage_forecast_normalized, weight=False)
        except:
            raise ValueError("There are no past events with a correlation coefficient above the defined threshold.")
        
        # Projection using station stats (for matter of comparison made later in postprocessing)
        self.Forecast.stats_station_forecast(self.date, self.UserConfiguration.user_streamflow, self.user_Qi)
        
        try:
            self.df_station_forecast = self.Forecast.timeseries_forecast(self.Forecast.Q_station_forecast, weight=False)
        except: 
            raise ValueError("There are no past events with a correlation coefficient above the defined threshold")
        print(self.scenarios_grouped)
        return self.df_streamflow_forecast, self.df_storage_forecast