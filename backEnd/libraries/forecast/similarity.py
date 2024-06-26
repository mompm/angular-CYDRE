# -*- coding: utf-8 -*-
"""
Created on Fri Jul  7 15:55:50 2023

@author: Nicolas Cornette
"""

# Modules
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from scipy.spatial.distance import pdist, squareform
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Cydre modules
from libraries.forecast import preprocessor as PR
from libraries.forecast import indicator as IN
from libraries.forecast import time_management as TI


class Similarity:
    
    """
    Class used to run the similarity analysis between watersheds and time series.
    """
    
    def __init__(self, params, simulation_date):
    
        # Store Similarity XML parameters
        self.params = params
        
        # Spatial parameters
        self.n_clusters = params.getgroup("spatial").getparam("n_clusters").getvalue()
        
        # Define the Cydre variables for which similarity will be calculated.
        self.TimeProperties = TI.TimeManagement(simulation_date)
        self.Indicator = IN.Indicator(self.params) # algorithmic parameters
        self.variables = ['specific_discharge', 'recharge']#, 'water_table_depth']
        self.variables_definition = {'specific_discharge': 'hydrometry',
                                     'recharge': 'climatic/surfex',
                                     'runoff': 'climatic/surfex',
                                     'water_table_depth':'piezometry'}
        self.correlation_matrix = {}
        
        
    def spatial_similarity(self, hydraulic_path):
        
        self.hydraulic_properties = self.__get_hydraulic_properties(hydraulic_path, parameters=['K1', 'D', 'K2/K1'])
        self.clusters = self.__watershed_clustering(self.hydraulic_properties)
        self.watershed_similarity = self.__watershed_similarity(self.hydraulic_properties)
        
        #for ws in self.clusters.index:
         #   watersheds[ws]['typology'] = int(self.clusters.loc[ws].typology)
    
    
    def __get_hydraulic_properties(self, hydraulic_path, parameters):
        
        df = pd.read_csv(os.path.join(hydraulic_path, 'hydraulic_properties.csv'), delimiter=';', decimal=",")
        df = df.set_index("ID")
        df.columns = ['name', 'K1', 'Theta1.d', 'K2', 'Theta2.d', 'D', 'K2/K1']
        df = df[parameters]
        df = df.sort_index()
                
        return df
    
        
    def __watershed_clustering(self, df):
        
        # Watershed clustering
        # Note: We use scaling so that each variable has equal importance when fitting
        # the k-means algorithm. Otherwise, the variables with the widest ranges
        # would have too much influence.
        scaled_df = StandardScaler().fit_transform(df)
        
        # instantiate the k-means class, using optimal number of clusters
        kmeans = KMeans(init="random", n_clusters=self.n_clusters, n_init=10, random_state=1)
        
        # fit k-means algorithm to data
        kmeans.fit(scaled_df)    
        
        # Fill the dataframe
        df['typology'] = kmeans.labels_
                
        return df
        
    
    def __watershed_similarity(self, df):
        
        # Calculer la distance euclidienne entre les lignes du DataFrame
        distance_matrix = pdist(df.values, metric='euclidean')

        # Convertir le vecteur de distances en une matrice carrée
        distance_matrix_square = squareform(distance_matrix)

        # Calculer la matrice de similarité
        similarity_matrix = 1 / (1 + distance_matrix_square)

        # Créer un DataFrame avec les index et les colonnes
        similarity_df = pd.DataFrame(similarity_matrix, index=df.index, columns=df.index)
    
        return similarity_df

    
    def get_similar_watersheds(self, user_watershed_id):
        
        user_watershed_typology = int(self.clusters.loc[user_watershed_id].typology)        
        self.similar_watersheds = list(self.clusters[self.clusters['typology'] == user_watershed_typology].index)        
        
    
    def timeseries_similarity(self, data_path, user_watershed_id, similar_watersheds):
        
        """
        Calculate temporal similarity between the user-selected watershed and regional historical watersheds.
        """

        for variable in self.variables:
            
            try:
                        
                # Storing the variable correlation matrix in a dataframe
                var_corr_matrix = pd.DataFrame()
                
                # Time series serving as a reference for the selected variable.
                user_watershed_df, years = self.__timeseries_preprocessing(data_path, variable, user_watershed_id, which="user")
                user_watershed_df = self.__set_similarity_period(user_watershed_df, self.TimeProperties.date, variable)
                self.user_similarity_period = self.TimeProperties._similarity_period
                
                for comp_watershed_id in similar_watersheds:
                    try:
                        # Storing the correlation coefficients and years in a list
                        similarity_coefficients = []
                        similarity_years = []
                        
                        #  Time series serving as a comparison for the selected variable
                        comp_watershed_df, _ = self.__timeseries_preprocessing(data_path, variable, comp_watershed_id, which='comparison')
                        
                        for year in years:                        
    
                            df = self.__set_similarity_period(comp_watershed_df, year, variable)
            
                            try:
                                # ----- SIMILARITY CALCULATION -----
                                common_indexes = self.__get_common_index(user_watershed_df, df)
                                comp_serie = df.Q[df.Q.index.strftime('%m-%d').isin(common_indexes)]
                                
                                similarity = self.Indicator.calculate_similarity(user_watershed_df.Q, comp_serie)
                                similarity_coefficients.append(similarity)
                                similarity_years.append(year.year)
                                # ----- SIMILARITY CALCULATION -----
                            except Exception as e:
                                print(f"Error processing year {year}, watershed {comp_watershed_id}, variable {variable}: {e}")
                        
                        # Fill the variable correlation matrix
                        tmp_matrix = pd.DataFrame(similarity_coefficients, index=similarity_years)
                        tmp_matrix.columns = [comp_watershed_id]
                        var_corr_matrix = pd.concat([var_corr_matrix, tmp_matrix], axis=1, sort=True)
                    
                    except Exception as e:
                        print(f"Error processing watershed {comp_watershed_id}, variable {variable}: {e}")
                
                # Store all variable correlation matrix in the general results dictionary
                self.correlation_matrix[variable] = var_corr_matrix
            
            except:
                print(f"No data for the variable {variable} at the date {self.TimeProperties.date}")
        
    
    def __timeseries_preprocessing(self, data_path, variable, watershed_id, which):
        
        variable_folder = self.variables_definition[variable]
        file_path = os.path.join(data_path, variable_folder, variable, "{}.csv".format(watershed_id)) 
        with open(file_path) as file:
            data = pd.read_csv(file, index_col="t")
            data.index = pd.to_datetime(data.index)  
            data = self.__timeseries_normalization(data)
            data = self.__timeseries_smoothing(data)
        
        years = None
        
        if which == 'user':
            self._extract_variable_parameters(variable)
            years = self.TimeProperties.get_nyears(data)
        
        return data, years
    
    
    def __timeseries_normalization(self, df):
        return (df - df.mean()) / df.std()
    
    
    def __timeseries_smoothing(self, df, window=1, min_periods=1):
        return df.rolling(window=window, min_periods=min_periods).mean()
    
    
    def _extract_variable_parameters(self, variable):
        time_params = self.params.getgroup(variable).getgroup("Time")
        self.TimeProperties.set_similarity_conditions(time_params)
        indicator_params = self.params.getgroup(variable).getgroup("Calculation")
        self.Indicator = IN.Indicator(indicator_params)
            
    
    def __set_similarity_period(self, df, date, variable):
        
        # Convert to hydrological year
        df = self.TimeProperties.convert_to_HY(df)
        
        # Period to calculate similarity of time series
        df = self.TimeProperties.similarity_period(df, date)
        
        # Convert the dataframe based on the variable-specific time step
        df = self.TimeProperties.time_step_conversion(df, variable)
        
        return df
    
    
    def __get_common_index(self, user_watershed_df, df):
        return df.index.strftime('%m-%d').intersection(user_watershed_df.index.strftime('%m-%d'))