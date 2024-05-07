# -*- coding: utf-8 -*-
"""
Created on Thu Sep 28 16:26:03 2023

@author: Nicolas Cornette
"""

# Modules
import pandas as pd
import numpy as np
from datetime import timedelta

# Cydre modules
from libraries.forecast import time_management as TI
from libraries.forecast import statistics as ST


class Forecast():
    
    
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
    
    
    def from_scenarios_extract_timeseries(self, watersheds, scenarios, simulation_date, user_Qi):
                        
        # Loop through each combination of watershed and year
        for (year, watershed_id), coeff in scenarios.items():
            
            try:
                if year == simulation_date.year:
                    print('There is no prospective data for the year {y}'.format(y=year))
                else:
                    # Extract watershed timeseries (streamflow, recharge, runoff and volume)
                    df_watershed = self._extract_timeseries(watersheds, watershed_id)
                    
                    # Time series smoothing for noise reduction
                    #df_watershed = self._timeseries_smoothing(df_watershed)
                    
                    # Subset the time series for the forecast period
                    df_subset, comp_Qi = self._extract_forecast_period(df_watershed,
                                                                       year,
                                                                       simulation_date,
                                                                       user_Qi)
                    
                    # Time series normalization
                    df_normalized = self._timeseries_normalization(df_subset, user_Qi, comp_Qi)
                    
                   # Store timeseries
                    if len(df_normalized) == self.forecast_horizon:
                        self.Q_streamflow_forecast.append(df_subset['Q_streamflow'])
                        self.Q_recharge_forecast.append(df_subset['Q_recharge'])
                        self.Q_runoff_forecast.append(df_subset['Q_runoff'])
                        self.Q_storage_forecast.append(df_subset['Q_storage'])
                        self.Q_streamflow_forecast_normalized.append(df_normalized['Q_streamflow'])
                        self.Q_recharge_forecast_normalized.append(df_normalized['Q_recharge'])
                        self.Q_runoff_forecast_normalized.append(df_normalized['Q_runoff'])
                        self.Q_storage_forecast_normalized.append(df_normalized['Q_storage'])
                        self.scenario_watershed.append(watershed_id)
                        self.scenario_year.append(year)
                        self.correlation_coeff.append(coeff)
            except:
                print('There is an issue with the watershed {w} for the year {y}'.format(w=watershed_id,
                                                                                         y=year))
        
        self.scenarios_with_chronicles = pd.DataFrame({'watershed':self.scenario_watershed,
                                                       'year':self.scenario_year,
                                                       'coeff':self.correlation_coeff})
    
    def timeseries_forecast(self, Q_to_forecast, weight=False):
        
        Q_to_forecast = self.concatenate_streamflow_timeseries(Q_to_forecast)
        
        if weight:
            
            # Generate streamflow projection by weightening timeseries with the correlation coefficient
            self.q10 = []
            self.q50 = []
            self.q90 = []
            
            prob = self.correlation_coeff/np.sum(self.correlation_coeff)
            print(np.sum(prob))
            
            for serie in Q_to_forecast.T:
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
            # Quantiles calculation
            self.q10 = np.nanpercentile(Q_to_forecast, 10, axis=0)
            self.q50 = np.nanpercentile(Q_to_forecast, 50, axis=0)
            self.q90 = np.nanpercentile(Q_to_forecast, 90, axis=0)
            self.qmean = np.nanmean(Q_to_forecast, axis=0)
        
        # Format results
        df_forecast = pd.DataFrame({'Q10':self.q10,
                                    'Q50':self.q50,
                                    'Q90':self.q90,
                                    'Qmean':self.qmean})
        
        df_forecast = df_forecast.set_index(self.forecast_period.strftime('%m-%d'))
        
        return df_forecast
    
        
    def _extract_timeseries(self, watersheds, watershed_id):
        streamflow = watersheds[watershed_id]['hydrometry']['specific_discharge']
        recharge = watersheds[watershed_id]['climatic']['recharge']
        runoff = watersheds[watershed_id]['climatic']['runoff']
        storage = recharge + runoff - streamflow
        
        df = pd.merge(streamflow, recharge, left_index=True, right_index=True, suffixes=('_streamflow', '_recharge'))
        df = pd.merge(df, runoff, left_index=True, right_index=True, suffixes=('', '_runoff'))
        df = pd.merge(df, storage, left_index=True, right_index=True, suffixes=('_runoff', '_storage'))
        return df
    
    
    def _timeseries_smoothing(self, df):
        return df.rolling(window=7, min_periods=1).mean()
    
    
    def _extract_forecast_period(self, df, year, user_ti, user_Qi):
        
        # Extract time series data for the forecast period (comparison watershed case)
        comp_ti = pd.to_datetime(str(year)+'-'+user_ti.strftime('%m-%d'))
        comp_Qi = df[df.index == comp_ti]
        comp_forecast_period = pd.date_range(start=comp_ti + timedelta(days=1),
                                             end=comp_ti + timedelta(days=self.forecast_horizon))
        df_subset = df[df.index.isin(comp_forecast_period)]
        
        return df_subset, comp_Qi
                
    
    def _timeseries_normalization(self, df_subset, user_Qi, comp_Qi):
        
        # Calculate the normalization factor
        normalization_factor = user_Qi['Q_streamflow'].values[0] / comp_Qi['Q_streamflow'].values[0]
        
        # Timeseries normalization
        df_normalized = df_subset * normalization_factor
       
        return df_normalized
    
    
    def concatenate_streamflow_timeseries(self, series):
        return np.vstack(series)
    
    
    def stats_station_forecast(self, simulation_date, user_df, user_Qi):
        
        years = np.unique(user_df.index.year)
        
        for year in years:
            
            try:
                print(year)
                
                # Subset the time series for the forecast period
                df_subset, comp_Qi = self._extract_forecast_period(user_df,
                                                                   year,
                                                                   simulation_date,
                                                                   user_Qi)
                
                comp_Qi['Q_streamflow'] = comp_Qi['Q']
                df_subset['Q_streamflow'] = df_subset['Q']
                
                # Time series normalization
                df_normalized = self._timeseries_normalization(df_subset, user_Qi, comp_Qi)
                
                # Store timeseries
                if len(df_normalized) == self.forecast_horizon:
                    self.Q_station_forecast.append(df_normalized['Q_streamflow'])
            
            except:
                print(f"Error with {year}")
            