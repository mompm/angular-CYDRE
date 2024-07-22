# -*- coding: utf-8 -*-
"""
Created on Thu Sep 28 16:26:03 2023

@author: Nicolas Cornette

Flow forecast based on the selected scenarios
Shifts the flow chronicles in order that all start at the same value, 
    as correlations have been performed on trends and not on absolute values
"""

# Modules
import os
import pandas as pd
import numpy as np
from datetime import timedelta

# Cydre modules
from libraries.forecast import time_management as TI
from libraries.forecast import statistics as ST


class Forecast():
    """
    Attributes
    ----------
    params : results from xml reader
        parameters xml (ALL).
    forecast_horizon: int
        échéance de la projection en nombre de jours
    last_date: pandas date time
        last day of projection
    forecast_period: list of date times
        each of the day on which a projection should be delivered
    Q_streamflow_forecast: vector
        Forecast on streamflow
    Q_XXX_forecast: vector
        Forecast on XXX
    scenario_watershed: vector
        list of identifier of the selected watersheds
    correlation_coeff: vector
        correlation coefficient (not the NSE) of each of the selected watershed
    Q_station_forecast: vector
        projection using only the data at the station, all the past years (not only the selected ones!)
        used as a reference for comparison
        
    Methods
    -------
    from_scenarios_extract_timeseries(self, data_path, scenarios, simulation_date, user_Qi):
        Recovers time series for the selected past scenarios    
    stats_station_forecast(self, simulation_date, user_df, user_Qi):
        Projection made using only the chronicles at the same station
        No similarity is used, it is used as a classical reference 
    timeseries_forecast(self, Q_to_forecast, weight=False):
        Statistics on the selected time series
    """
    
    
    def __init__(self, params, simulation_date):
        
        # Forecast parameters
        self.params = params
        self.forecast_horizon = self.params.getparam("user_horizon").getvalue()
        last_date = simulation_date + timedelta(days=self.forecast_horizon)
        self.forecast_period = pd.date_range(start=simulation_date+timedelta(days=1), end=last_date)
        
        # Forecast series
        self.Q_streamflow_forecast = []
        self.Q_recharge_forecast = []
        self.Q_runoff_forecast = []
        self.Q_storage_forecast = []
        self.Q_streamflow_forecast_normalized = []
        self.Q_recharge_forecast_normalized = []
        self.Q_runoff_forecast_normalized = []
        self.Q_storage_forecast_normalized = []
        self.scenario_watershed = []
        self.scenario_year = []
        self.correlation_coeff = []
        self.Q_station_forecast = []
    
    
    def from_scenarios_extract_timeseries(self, data_path, scenarios, simulation_date, user_Qi):
        """
        Recovers scenario time series
        Readjusts them to have the same flow rate at the projection start date. 
        If the forecast date has been changed (a few days earlier) to avoid a flow peak, we reset to the previous date.

        ATTENTION: some selection is made again here, the watersheds selected at the same year are removed!!     

        Parameters
        ----------
        data_path : string
            location of the data stored
        scenarios : dataframe
            dataframe with all the scenarios (with only the selected scenarios)
        simulation_date : pandas date time
            date of the beginning of the projection (ATTENTION: might have been readjusted-ie moved some days before)
        user_Qi : float
            reference flow at the date of the projection, the one that every projected scenario should have 

        Returns
        -------
        self: 
            Modifies the initialized XXX_forecast

        """         
        
        # Loop through each combination of watershed and year of the selected scenarios
        for (year, watershed_id), coeff in scenarios.items():
            
            try:
                if year == simulation_date.year:
                    # If it is the same year, there is not any possible forecast
                    print('There is no prospective data for the year {y}'.format(y=year))
                else:
                    # Extract watershed timeseries (streamflow, recharge, runoff and volume)
                    df_watershed = self.__extract_timeseries(data_path, watershed_id)
                    
                    # Time series smoothing for noise reduction
                    #df_watershed = self.__timeseries_smoothing(df_watershed)
                    
                    # Subset of the time series for the forecast period
                    df_subset, comp_Qi = self.__extract_forecast_period(df_watershed,
                                                                       year,
                                                                       simulation_date,
                                                                       user_Qi)
                    
                    # Time series normalization to impose the same "initial" flow
                    df_normalized = self.__timeseries_normalization(df_subset, user_Qi, comp_Qi)
                    
                   # Store timeseries
                    if len(df_normalized) == self.forecast_horizon:
                        # Creates the forecasted vectors for each of the time series
                        self.Q_streamflow_forecast.append(df_subset['Q_streamflow'])
                        self.Q_recharge_forecast.append(df_subset['Q_recharge'])
                        self.Q_runoff_forecast.append(df_subset['Q_runoff'])
                        self.Q_storage_forecast.append(df_subset['Q_storage'])
                        self.Q_streamflow_forecast_normalized.append(df_normalized['Q_streamflow'])
                        self.Q_recharge_forecast_normalized.append(df_normalized['Q_recharge'])
                        self.Q_runoff_forecast_normalized.append(df_normalized['Q_runoff'])
                        self.Q_storage_forecast_normalized.append(df_normalized['Q_storage'])
                        # Update the list of effectively selected scenarios
                        self.scenario_watershed.append(watershed_id)
                        self.scenario_year.append(year)
                        self.correlation_coeff.append(coeff)
            except:
                print('There is an issue with the watershed {w} for the year {y}'.format(w=watershed_id,
                                                                                         y=year))
        # Necessary to be performed again as some scenarios may have been removed (for the same year)
        self.scenarios_with_chronicles = pd.DataFrame({'watershed':self.scenario_watershed,
                                                       'year':self.scenario_year,
                                                       'coeff':self.correlation_coeff})
    
    
    #NICOLAS: nom à moidifier timeseries_statistics
    def timeseries_forecast(self, Q_to_forecast, weight=False):
        """
        Statistics on the selected time series

        Parameters
        ----------
        Q_to_forecast : list of dataframes
            one dataframe per scenario    
            flows for each of the scenarios (flows have already been renormalized at the right date)
        weight : bool
            == true : weighting of the scenarios by the correlation coefficient
            == false: all scenarios have the same weight

        Returns
        -------
        df_forecast : dataframe
            Statsitics of the scenarios

        """
        
        # Puts all scenarios in the same matrix (lines: scenarios; columns: time steps)
        Q_to_forecast = self.concatenate_streamflow_timeseries(Q_to_forecast)
        
        if weight:
            # Takes the relative correlation coefficient as a weighting factor of the scenario
            
            # Generate streamflow projection by weightening timeseries with the correlation coefficient
            self.q10 = []
            self.q50 = []
            self.q90 = []
            
            # prob is the relative importance of the scenario
            prob = self.correlation_coeff/np.sum(self.correlation_coeff)
            print(np.sum(prob))
            
            for serie in Q_to_forecast.T:
                # Statistics for each of the columns, ie for each of the dates
                self.q10.append(ST.Statistics.quantile_with_weights(sample=serie,
                                                                    weights=prob,
                                                                    quantile=0.1))
                self.q50.append(ST.Statistics.quantile_with_weights(sample=serie,
                                                                    weights=prob,
                                                                    quantile=0.5))
                self.q90.append(ST.Statistics.quantile_with_weights(sample=serie,
                                                                    weights=prob,
                                                                    quantile=0.9))
        
        else:
            # Quantiles calculation without weighting factor
            self.q10 = np.nanpercentile(Q_to_forecast, 10, axis=0)
            self.q50 = np.nanpercentile(Q_to_forecast, 50, axis=0)
            self.q90 = np.nanpercentile(Q_to_forecast, 90, axis=0)
            self.qmean = np.nanmean(Q_to_forecast, axis=0)
        
        # Format results: dataframe in columns (line:time, column: q10, q50, q90, qmean)
        df_forecast = pd.DataFrame({'Q10':self.q10,
                                    'Q50':self.q50,
                                    'Q90':self.q90,
                                    'Qmean':self.qmean})
        
        df_forecast = df_forecast.set_index(self.forecast_period.strftime('%m-%d'))
        
        return df_forecast
    
        
    def __extract_timeseries(self, data_path, watershed_id):
        # Loading the data stored in the files
        
        streamflow_path = os.path.join(data_path, "hydrometry", "specific_discharge", "{}.csv".format(watershed_id)) 
        with open(streamflow_path) as file:
            streamflow = pd.read_csv(file, index_col="t")
            streamflow.index = pd.to_datetime(streamflow.index)
        
        recharge_path = os.path.join(data_path, "climatic", "surfex", "recharge", "{}.csv".format(watershed_id)) 
        with open(recharge_path) as file:
            recharge = pd.read_csv(file, index_col="t")
            recharge.index = pd.to_datetime(recharge.index)
        
        runoff_path = os.path.join(data_path, "climatic", "surfex", "runoff", "{}.csv".format(watershed_id)) 
        with open(runoff_path) as file:
            runoff = pd.read_csv(file, index_col="t")
            runoff.index = pd.to_datetime(runoff.index)
            
        storage = recharge + runoff - streamflow 
        
        df = pd.merge(streamflow, recharge, left_index=True, right_index=True, suffixes=('_streamflow', '_recharge'))
        df = pd.merge(df, runoff, left_index=True, right_index=True, suffixes=('', '_runoff'))
        df = pd.merge(df, storage, left_index=True, right_index=True, suffixes=('_runoff', '_storage'))

        return df
    
    
    def __timeseries_smoothing(self, df):
        return df.rolling(window=7, min_periods=1).mean()
    
    
    def __extract_forecast_period(self, df, year, user_ti, user_Qi):
        
        # Extract time series data for the forecast period (comparison watershed case)
        comp_ti = pd.to_datetime(str(year)+'-'+user_ti.strftime('%m-%d'))
        comp_Qi = df[df.index == comp_ti]
        comp_forecast_period = pd.date_range(start=comp_ti + timedelta(days=1),
                                             end=comp_ti + timedelta(days=self.forecast_horizon))
        df_subset = df[df.index.isin(comp_forecast_period)]
        
        return df_subset, comp_Qi
                
    
    def __timeseries_normalization(self, df_subset, user_Qi, comp_Qi):
        
        # Calculate the normalization factor
        normalization_factor = user_Qi['Q_streamflow'].values[0] / comp_Qi['Q_streamflow'].values[0]
        
        # Timeseries normalization
        df_normalized = df_subset * normalization_factor
       
        return df_normalized
    
    #NICOLAS: à mettre en privé?
    def concatenate_streamflow_timeseries(self, series):
        return np.vstack(series)
    
    
    def stats_station_forecast(self, simulation_date, user_df, user_Qi):
        # Projection made using only the chronicles at the same station
        # No similarity is used, it is used as a classical reference 
        
        years = np.unique(user_df.index.year)
        
        for year in years:
            
            try:
                print(year)
                
                # Subset the time series for the forecast period
                df_subset, comp_Qi = self.__extract_forecast_period(user_df,
                                                                   year,
                                                                   simulation_date,
                                                                   user_Qi)
                
                comp_Qi['Q_streamflow'] = comp_Qi['Q']
                df_subset['Q_streamflow'] = df_subset['Q']
                
                # Time series normalization
                df_normalized = self.__timeseries_normalization(df_subset, user_Qi, comp_Qi)
                
                # Store timeseries
                if len(df_normalized) == self.forecast_horizon:
                    self.Q_station_forecast.append(df_normalized['Q_streamflow'])
            
            except:
                print(f"Error with {year}")
            