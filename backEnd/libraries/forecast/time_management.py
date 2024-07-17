# -*- coding: utf-8 -*-
"""
Created on Thu Jun 15 16:58:55 2023

@author: Nicolas Cornette

Management of time and time ranges

Note: 
    Resetting the correlation search period in the event of significant 
    precipitation on the simulation start day 
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
    
    
    Attributes
    ----------
    date: pandas date time
        date at which the projection should be started
    time_step: string
        time base: D (dayly), W (weekly), M (monthly)
    similarity_period_calculation: string
        Type of period range
        similarity_period_calculation == "ndays": number of days before date of simulation
        similarity_period_calculation == "period": initial date corresponding to 1st of Octobre, beginning of hydrological year (no longer actively used)
    ndays: int
        number of days on which the correlation should be computed
        
    Methods
    -------
    define_simulation_date(params, data_path, version, user_watershed_id, bss_id):
        Resetting the correlation search period in the event of significant 
        precipitation on the simulation start day 
    similarity_period(self, df, date):
        Restriction of the dataframe to the period over which correlation should be computed       
        
    """

    def __init__(self, date):

        self.date = date

        # Recharge period definition
        #NICOLAS: à modifier pour la date de début d'année hydrologique, 
        #         à extraire dans le fichier de paramètres xml 
        #         à documenter au-dessus
        self.recharge_months = ['10', '11', '12', '01', '02']


    def set_similarity_conditions(self, params):
        """
        Period over which correlation is calculated, 
        either a number of days or since the start of the hydrological year. 
        
        Note that the period may depend on the variable (precipitation, recharge, flow, etc.). 
        Although this option is not currently used, all parameter and class structures allow it without modification. 

        Parameters
        ----------
        params : xml derived parameter structure
            parameters for the variable only (not all the structure)
        """

        # Time properties parameters
        self.params = params

        # Timeseries similarity analysis parameters
        self.time_step = params.getparam("time_step").getvalue()
        self.similarity_period_calculation = params.getparam(
            "similarity_period_calculation").getvalue()
        self.ndays = params.getparam("ndays_before_forecast").getvalue(
        ) if self.similarity_period_calculation == 'ndays' else None


    #NICOLAS: supprimer version 
    @staticmethod
    def define_simulation_date(params, data_path, version, user_watershed_id, bss_id):
        """
        Resetting the correlation search period in the event of significant 
        precipitation on the simulation start day 

        Parameters
        ----------
        #NICOLAS: remplacer l'appel à params par l'appel à la date seule 
        params : xml derived parameter structure 
            params structure necessary to get the date of simulation
        data_path : string
            folder location
        user_watershed_id : string
            reference watershed on which simulation is performed
        bss_id : string
            piezometric station attached to the watershed
            should be necessarily one, defined in stations.csv (file describing the watersheds)

        Raises
        ------
        ValueError
            DESCRIPTION.

        Returns
        -------
        simulation_date : pandas date time
            date from which the correlation should be performed
            ATTENTION: it can be different fro the date at which the simulation should be started

        """

        # 1-CHECK DATA AVIALABILITY: load data and get last date of data avialable
        streamflow_path = os.path.join(data_path, "hydrometry", "specific_discharge", "{}.csv".format(user_watershed_id)) 
        with open(streamflow_path) as file:
            streamflow = pd.read_csv(file, index_col="t")
            streamflow.index = pd.to_datetime(streamflow.index)
            date_streamflow = streamflow.index[-1]
        
        recharge_path = os.path.join(data_path, "climatic", "surfex", "recharge", "{}.csv".format(user_watershed_id)) 
        with open(recharge_path) as file:
            recharge = pd.read_csv(file, index_col="t")
            recharge.index = pd.to_datetime(recharge.index)
            date_recharge = recharge.index[-1]
        
        piezo_path = os.path.join(data_path, "piezometry", "{}.csv".format(bss_id)) 
        with open(piezo_path) as file:
            piezo = pd.read_csv(file, index_col="t")
            piezo.index = pd.to_datetime(piezo.index)
            date_piezo = piezo.index[-1]

        if version == 'application':
            #NICOLAS: à supprimer? 
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
            
            # On all latests dates of recharge, streamflow, piezo, keeps the eariest
            simulation_date = min(date_recharge, date_streamflow, date_piezo, simulation_date)
            
            # 2- CHECK CONDITION ON PRECIPITATION
            #   On the NDAYS_BELOW_CONDITIONS below simulation_date, 
            #   whe should have had less than CONDITIONS mm of precipitations
            NDAYS_BELOW_CONDITIONS = 4 # days
            CONDITIONS = 3 # mm
            
            precipitation_path = os.path.join(data_path, "climatic", "surfex", "precipitation", "{}.csv".format(user_watershed_id)) 
            with open(precipitation_path) as file:
                precipitation = pd.read_csv(file, index_col="t")
                precipitation.index = pd.to_datetime(precipitation.index)
            rolling_precipitation = precipitation['Q'].rolling(window=NDAYS_BELOW_CONDITIONS).max()
            check_conditions = rolling_precipitation <= CONDITIONS
            
            precipitation['conditions'] = check_conditions
            
            # 3- RECALCULATE SIMULATION DATE IF NECESSARY
            if precipitation.loc[simulation_date].conditions == False:
                filtered_df = precipitation.loc[:simulation_date]
                # Gets the latest NDAYS_BELOW_CONDITIONS period on which we have had less than CONDITIONS mm of precipitations
                latest_true_date = filtered_df[filtered_df['conditions'] == True].index.max()
                simulation_date = pd.to_datetime(latest_true_date)

        return simulation_date
    
    
    def CheckLeap(self, Year):
        # Checking if the given year is leap year (année bisextile)
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

        """
        Restriction of the datagframe to the period over which correlation should be computed       
        
        self.similarity_period_calculation == 'period'
            over the whole hydrological year
        self.similarity_period_calculation == 'ndays'
            over the ndays previous days 
            
        Specifique à chaque année individuelle
        
        Parameters
        ----------
        df : dataframe
            input dataframe
        date : pandas data time
            ending date of the correlation period 
            Might be different from the starting simulation date

        Returns
        -------
        df : dataframe
            dataframe restricted to the period over which correlation should be computed

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
        """
        Gets the number of list of years where the chronicle is avialable at the date of "self.date"

        Parameters
        ----------
        df : pandas dataframe
            data of the waterthsed (in parctice, only alled for the reference watershed)

        Returns
        -------
        years : list of strings
            list of years 

        """
        
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
            df = self.__convert_to_weekly(df)

        elif self.time_step == 'M':
            df = self.__convert_to_montlhy(df)

        elif self.time_step == 'cumM':
            df = self.__convert_to_monthly_cum(df)

        return df


    def __convert_to_weekly(self, df):
        df = df.resample('W').mean()
        df = df.dropna(subset=['Q'])
        return df


    def __convert_to_monthly(self, df):
        df = df.resample('M').mean()
        df = df.dropna(subset=['Q'])
        return df


    def __convert_to_monthly_cum(self, df):
        df = df.resample('M').sum()
        df = df.dropna(subset=['Q'])
        return df
