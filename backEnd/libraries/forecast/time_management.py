# -*- coding: utf-8 -*-
"""
Created on Thu Jun 15 16:58:55 2023

@author: Nicolas Cornette
"""

# Modules
import os
import numpy as np
import pandas as pd
from datetime import date
from datetime import datetime
from datetime import timedelta


class TimeManagement():

    """
    Class used to define the hydrological periods.
    1) we define which period corresponds to the recharge and which period corresponds to the discharge.
    2) we define what is a hydrological year.
    """

    def __init__(self, date):

        self.date = date

        # Recharge period definition
        self.recharge_months = ['10', '11', '12', '01', '02']
        self.low_flows_months = ['03', '04', '05', '06', '07', '08', '09']


    def set_similarity_conditions(self, params):

        # Time properties parameters
        self.params = params

        # Timeseries similarity analysis parameters
        self.time_step = params.getparam("time_step").getvalue()
        self.similarity_period_calculation = params.getparam(
            "similarity_period_calculation").getvalue()
        self.ndays = params.getparam("ndays_before_forecast").getvalue(
        ) if self.similarity_period_calculation == 'ndays' else None


    def define_simulation_date(params, data_path, version, user_watershed_id, bss_id):

        # Check data availability
        #streamflow = user_watershed['hydrometry']['specific_discharge'] 
        streamflow_path = os.path.join(data_path, "hydrometry", "specific_discharge", "{}.csv".format(user_watershed_id)) 
        with open(streamflow_path) as file:
            streamflow = pd.read_csv(file, index_col="t")
            streamflow.index = pd.to_datetime(streamflow.index)
            date_streamflow = streamflow.index[-1]
        #check_streamflow = (today_date - date_streamflow).days <= conditions
        
        #recharge = user_watershed['climatic']['recharge'] 
        recharge_path = os.path.join(data_path, "climatic", "surfex", "recharge", "{}.csv".format(user_watershed_id)) 
        with open(recharge_path) as file:
            recharge = pd.read_csv(file, index_col="t")
            recharge.index = pd.to_datetime(recharge.index)
            date_recharge = recharge.index[-1]
        #check_recharge = (today_date - date_recharge).days <= conditions
        
        piezo_path = os.path.join(data_path, "piezometry", "{}.csv".format(bss_id)) 
        with open(piezo_path) as file:
            piezo = pd.read_csv(file, index_col="t")
            piezo.index = pd.to_datetime(piezo.index)
        #piezo = user_watershed['piezometry']['water_table_depth']
            date_piezo = piezo.index[-1]

        if version == 'application':
            
            # Today date and conditions
            today_date = pd.to_datetime(date.today())
            conditions = 7
            
            # Check data availability
            check_streamflow = (today_date - date_streamflow).days <= conditions        
            check_recharge = (today_date - date_recharge).days <= conditions
            #print('Diff with Recharge:', (today_date - date_recharge).days)
            
            # Define simulation date
            if check_streamflow and check_recharge:
                # Find the oldest availability between all data
                # Use the oldest availability as the simulation date and return the diff for adding to the horizon forecast
                simulation_date = min(date_streamflow, date_recharge)
            else:
                raise ValueError("Data need to be updated for CYDRE application mode use. Please contact an admin.")
            
            # Check precipitation conditions
            NDAYS_BELOW_CONDITIONS = 4 # days
            CONDITIONS = 3 # mm
            
            precipitation_path = os.path.join(data_path, "climatic", "surfex", "precipitation", "{}.csv".format(user_watershed_id)) 
            with open(precipitation_path) as file:
                precipitation = pd.read_csv(file, index_col="t")
                precipitation.index = pd.to_datetime(precipitation.index)
            #precipitation = user_watershed['climatic']['precipitation']
                rolling_precipitation = precipitation['Q'].rolling(window=NDAYS_BELOW_CONDITIONS).max()
            
            check_conditions = rolling_precipitation <= CONDITIONS
            precipitation['conditions'] = check_conditions
            
            # Recalculate the simulation date if necessary
            if precipitation.loc[simulation_date].conditions == False:
                filtered_df = precipitation.loc[:simulation_date]
                latest_true_date = filtered_df[filtered_df['conditions'] == True].index.max()
                simulation_date = pd.to_datetime(latest_true_date)

            
            #simulation_date = pd.to_datetime(date.today())
        
        else:    
            # User define the simulation date
            simulation_date = pd.to_datetime(params.getgroup('General').getparam('date').getvalue())
            simulation_date = simulation_date.strftime('%Y-%m-%d')
            simulation_date = pd.to_datetime(simulation_date)
            
            # Check conditions
            simulation_date = min(date_recharge, date_streamflow, date_piezo, simulation_date)
            
            # Check precipitation conditions
            NDAYS_BELOW_CONDITIONS = 4 # days
            CONDITIONS = 3 # mm
            
            #precipitation = user_watershed['climatic']['precipitation']
            precipitation_path = os.path.join(data_path, "climatic", "surfex", "precipitation", "{}.csv".format(user_watershed_id)) 
            with open(precipitation_path) as file:
                precipitation = pd.read_csv(file, index_col="t")
                precipitation.index = pd.to_datetime(precipitation.index)
            rolling_precipitation = precipitation['Q'].rolling(window=NDAYS_BELOW_CONDITIONS).max()
            check_conditions = rolling_precipitation <= CONDITIONS
            
            precipitation['conditions'] = check_conditions
            
            # Recalculate the simulation date if necessary
            if precipitation.loc[simulation_date].conditions == False:
                filtered_df = precipitation.loc[:simulation_date]
                latest_true_date = filtered_df[filtered_df['conditions'] == True].index.max()
                simulation_date = pd.to_datetime(latest_true_date)

        return simulation_date
    
    
    def CheckLeap(self, Year):
        # Checking if the given year is leap year
        if ((Year % 400 == 0) or (Year % 100 != 0) and (Year % 4 == 0)):
            leap = True
        # Else it is not a leap year
        else:
            leap = False
        return leap


    def DayOfYear(self, df):

        df['DayOfYear'] = df.index.to_series().apply(self.position_in_year)

        return df

    
    def position_in_year(self, date):

        # Start date of the year (October 1st of the previous year)
        year_start = datetime(date.year, 10, 1)

        # If the date is before October 1st, use the previous year
        if date < year_start:
            year_start = datetime(date.year - 1, 10, 1)

        # Calculate the position in the year
        position = (date - year_start).days + 1

        return position


    def convert_to_HY(self, df):
        """
        Convert calendar year to hydrological year.
        Hydrological year: 01/10/YY-1 - 30/09/YY.

        Parameters
        ----------
        df : DataFrame
            df timeseries.

        Returns
        -------
        df : DataFrame
            df timeseries.

        """
        years = df.index.year
        df = df.copy()
        df.loc[:, 'HydroYear'] = np.where(
            df.index.month <= 9, years, years + 1)

        return df


    def similarity_period(self, df, date):

        # Specifique à chaque année individuelle
        """
        DESCRIPTION.

        Parameters
        ----------
        df : TYPE
            DESCRIPTION.

        Returns
        -------
        df : TYPE
            DESCRIPTION.

        """

        if self.similarity_period_calculation == 'period':

            # first date
            first_recharge_day = pd.to_datetime(
                str(self.date.year-1) + '-' + self.recharge_months[0] + '-01')

            # similarity period sequence
            self._similarity_period = pd.date_range(
                start=first_recharge_day, end=self.date, freq='D')
            self._similarity_period = self._similarity_period[(
                self._similarity_period.month != 2) | (self._similarity_period.day != 29)] # Remove 29th Feb.
            idx = self._similarity_period.strftime('%m-%d')

            # subset dataframe with day index
            df_subset = df[df.index.strftime('%m-%d').isin(idx)]

        if self.similarity_period_calculation == 'ndays':
            
            # Similarity calculation period
            self._similarity_period = pd.date_range(date - timedelta(days=self.ndays-1), date)
            df_subset = df[df.index.isin(self._similarity_period)]

        return df_subset
    
    
    def get_nyears(self, df):
        
        df = self.DayOfYear(df)
        #/!\ Si les données n'existent pas jusqu'à la date du jour, il y a un bug.
        # C'est le cas dans un mode "APPLICATION" où la date de simulation est la date du jour.
        # Pour simplifier il faudrait peut-être recaler la date de simulation en fonction de l'ancienneté
        # la plus récente des données et ajouter la différence en nombre de jours sur l'échéance de la prévision.
        # On pourrait recaler les projections par la suite ??? /!\
        self._position_in_year = df[df.index == self.date].DayOfYear.values[0]
        years = df[df['DayOfYear'] == self._position_in_year].index
        
        return years
        

    def get_year(self, df, year):

        # subset dataframe with year index
        df_subset = df[df['HydroYear'] == int(year)]

        return df_subset


    def time_step_conversion(self, df, variable):

        if self.time_step == 'W':
            df = self.convert_to_weekly(df)

        elif self.time_step == 'M':
            df = self.convert_to_montlhy(df)

        elif self.time_step == 'cumM':
            df = self.convert_to_monthly_cum(df)

        return df


    def convert_to_weekly(self, df):
        df = df.resample('W').mean()
        df = df.dropna(subset=['Q'])
        return df


    def convert_to_monthly(self, df):
        df = df.resample('M').mean()
        df = df.dropna(subset=['Q'])
        return df


    def convert_to_monthly_cum(self, df):
        df = df.resample('M').sum()
        df = df.dropna(subset=['Q'])
        return df
