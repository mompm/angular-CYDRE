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

import warnings
warnings.filterwarnings("ignore", message="KMeans is known to have a memory leak on Windows with MKL")

# Cydre modules
from libraries.forecast import indicator as IN
from libraries.forecast import time_management as TI



class Similarity:
    """
    Class used to run the similarity analysis between watersheds on both 
    - timeseries (precipitation, ETP, recharge, hydrometry)
    - hydraulic conductivities
    
    Note: 
        TimeSeries (chornicles) are first normalized (distribution of mean 0 and std 1) and smoothed (moving average over several days)
        Recalage temporel en cas de précipitations réalisé dans la classe TimeProperties mais paramétré avant dans la classe Cydre
    
    Attributes
    ----------
    params 
        xml input parameters 
    n_clusters: int
        number of classes of watersheds
    TimeProperties
        Management of times (timesteps, dates)
    variables: list of strings
        List of data types on which similarity will be performed
    variable_definition: dictionary
        Relation between variable and path in the data structure of the repository
    correlation_matrix: 
        List of correlation matrices (one for each of the variables)
    hydraulic_properties
        dataframe of hydraulic properties for each of the watersheds
    clusters 
        classification of watersheds according to their hydraulic properties
    watershed_similarity 
        indicator of similarity between watersheds (alltogether)
    similar_watersheds
        gets list of watershed ID within the same class of a given watershed
    similar_watersheds_names
        gets list of watershed names within the same class of a given watershed
    user_similarity_period
        vector of dates on which similarity should be performed
    
    Methods
    -------
    spatial_similarity(self, hydraulic_path)
        Clustering (kmeans) of the watersheds according to their hydraulic conductivities
        and comutation of distances between watersheds, distances in terms of hydraulic conductivities given by xml files
    timeseries_similarity(self, data_path, user_watershed_id, similar_watersheds)
        Computes similarities between watersheds according to chronicles 

    Methods private
    -------
    __watershed_similarity(self, df):
            Computes a measure of the similarity between watersheds within the same cluster
    __timeseries_preprocessing(self, data_path, variable, watershed_id, which)
                Load, normalize and smooth (pics de crue) of chronicle
        
    """
    
    def __init__(self, params, simulation_date):
    
        # Store Similarity XML parameters
        self.params = params
        
        # Spatial parameters
        self.n_clusters = params.getgroup("spatial").getparam("n_clusters").getvalue()
        
        # Define the Cydre variables for which similarity will be calculated.
        # Performs the "recalage temporel" in case of heavy precipitations
        # necesssity and characteristics of the recalage are done before in "Cydre" class
        self.TimeProperties = TI.TimeManagement(simulation_date)
        self.Indicator = IN.Indicator(self.params) # algorithmic parameters
        #NICOLAS : ajouter le contenu de variables dans les paramètres xml à charger 
        #          et faire un test pour savoir si les variables sélectionnées sont bien dans la liste suivante
        self.variables = ['specific_discharge', 'recharge']#, 'water_table_depth']
        self.variables_definition = {'specific_discharge': 'hydrometry',
                                     'recharge': 'climatic/surfex',
                                     'runoff': 'climatic/surfex',
                                     'water_table_depth':'piezometry'}
        self.correlation_matrix = {}
        
        
    def spatial_similarity(self, hydraulic_path):
        """
        Clustering (kmeans) of the watersheds according to their hydraulic conductivities

        Parameters
        ----------
        hydraulic_path : string
            File where hydraulic conductivities are stored

        Returns
        -------
        Modification of self

        """
        
        #NICOLAS: Remonter le contenu de parameters comme inputs du fichier xml 
        self.hydraulic_properties = self.__get_hydraulic_properties(hydraulic_path, parameters=['K1', 'D', 'K2/K1'])
        self.clusters = self.__watershed_clustering(self.hydraulic_properties)
        self.watershed_similarity = self.__watershed_similarity(self.hydraulic_properties)
        
    
    
    def __get_hydraulic_properties(self, hydraulic_path, parameters):
        """
        Loads hydraulic parameters of the watershed database

        Parameters
        ----------
        hydraulic_path : string
            File where hydraulic conductivities are stored
        parameters : list of strings
            Parmaters that should be kept from the data file to run the similarity

        Returns
        -------
        df : pandas dataframe
            matrix of watershed and hydraulic parameters by row 
            [name,parameters]

        """
        
        df = pd.read_csv(os.path.join(hydraulic_path, 'hydraulic_properties.csv'), delimiter=';', decimal=",")
        df = df.set_index("ID")
        df.columns = ['name', 'K1', 'Theta1.d', 'K2', 'Theta2.d', 'D', 'K2/K1']
        df = df[parameters]
        df = df.sort_index()
                
        return df
    
        
    def __watershed_clustering(self, df):
        """
        Watershed clustering
        Note: We use scaling so that each variable has equal importance when fitting
        the k-means algorithm. Otherwise, the variables with the widest range
        would have too much influence.
        
        Parameters
        ----------
        df : pandas data frame
            hydraulic conductivity by watershed

        Returns
        -------
        df : pandas data frame
            modifies the input data frame with one more column "typology"

        """
        
        # Function from sklearn (scikit learn) to normalize data to zero mean an unitary variance (performed on each of the columns)
        scaled_df = StandardScaler().fit_transform(df)
        
        # Instantiate the k-means class, using optimal number of clusters
        kmeans = KMeans(init="random", n_clusters=self.n_clusters, n_init=10, random_state=1)
        
        # Fit k-means algorithm to data
        kmeans.fit(scaled_df)    
        
        # Fill the dataframe
        df['typology'] = kmeans.labels_
                
        return df
        
    
    def __watershed_similarity(self, df):
        """
        Computes a measure of the similarity between watersheds within the same cluster

        Parameters
        ----------
        df : pandas data frame
            data including the clustering of watershed

        Returns
        -------
        similarity_df : pandas dataframe
            similarity matrix of coefficeints in ]0,1]
            similarity_df[i,j] : similarity between watersheds of indices i and j

        """
        
        # Calculer la distance euclidienne entre les lignes du DataFrame
        # suivant les différentes dimensions données en colonnes 
        distance_matrix = pdist(df.values, metric='euclidean')

        # Convertir le vecteur de distances en une matrice carrée
        distance_matrix_square = squareform(distance_matrix)

        # Transformation to get similarity in ]0,1]
        similarity_matrix = 1 / (1 + distance_matrix_square)

        # Créer un DataFrame avec les index et les colonnes
        similarity_df = pd.DataFrame(similarity_matrix, index=df.index, columns=df.index)
    
        return similarity_df

    
    def get_similar_watersheds(self, user_watershed_id, gdf_stations):
        """
        Selection of watersheds of cluster of index "user_watershed_id"
        """
        # index of class of the watershed numbered "user_watershed_id"
        user_watershed_typology = int(self.clusters.loc[user_watershed_id].typology)        
        # gets list of watershed within the same class
        self.similar_watersheds = list(self.clusters[self.clusters['typology'] == user_watershed_typology].index)
        gdf_similars = gdf_stations[gdf_stations['ID'].isin(self.similar_watersheds)]
        self.similar_watersheds_names = gdf_similars["name"].values        
        
    
    def timeseries_similarity(self, data_path, user_watershed_id, similar_watersheds):
        """
        Calculate temporal similarity between the user-selected watershed and regional historical watersheds
        over three embedded loops over variables, watersheds and years 
        Limiting function of the software
        
        Note: All data should not be loaded at once (recharge, precip, flow...) to avoid memory overload
        Data should thus be loaded and dumped sequentially 

        Parameters
        ----------
        data_path : string
            where the data are stored
        user_watershed_id : string (id banquehydro)
            watershed used as reference 
        similar_watersheds : list of strings
            watersheds within the same class (as defined from the hydraulic properties)

        Returns
        -------
        self.correlation_matrix
            Constructs the list of correlations matrices

        """
        
        for variable in self.variables:
            
            try:
                        
                # Storing the variable correlation matrix in a dataframe
                var_corr_matrix = pd.DataFrame()
                
                # Time series serving as a reference for the selected variable.
                user_watershed_df, years = self.__timeseries_preprocessing(data_path, variable, user_watershed_id, which="user")
                # Limits the chronicle to the period on which similarity should be performed
                user_watershed_df = self.__set_similarity_period(user_watershed_df, self.TimeProperties.date, variable)
                # vector of dates on which similarity should be performed
                self.user_similarity_period = self.TimeProperties._similarity_period
                
                for comp_watershed_id in similar_watersheds:
                    try:
                        # Storing the correlation coefficients and years as lists
                        similarity_coefficients = []
                        similarity_years = []
                        
                        #  Time series serving as a comparison for the selected variable
                        comp_watershed_df, _ = self.__timeseries_preprocessing(data_path, variable, comp_watershed_id, which='comparison')
                        
                        # For the selected years
                        for year in years:                        
    
                            # Reduces the chronicle to the selected year
                            df = self.__set_similarity_period(comp_watershed_df, year, variable)
            
                            try:
                                # ----- SIMILARITY CALCULATION -----
                                # Keeps days on which data are present both in reference and in compared chronicle
                                common_indexes = self.__get_common_index(user_watershed_df, df)
                                comp_serie = df.Q[df.Q.index.strftime('%m-%d').isin(common_indexes)]
                                # Main function on which similarity is computed effectively 
                                similarity = self.Indicator.calculate_similarity(user_watershed_df.Q, comp_serie)
                                # Fills out correlation matrix
                                similarity_coefficients.append(similarity)
                                similarity_years.append(year.year)
                                # ----- SIMILARITY CALCULATION -----
                            except Exception as e:
                                print(f"Error processing year {year}, watershed {comp_watershed_id}, variable {variable}: {e}")
                        
                        # Fills the variable correlation matrix
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
        """
        Load, normalize and smoothes (pics de crue) of chronicle

        Parameters
        ----------
        data_path : string
            where data are stored
        variable : string
            name of chronicle
        watershed_id : string
            identifier of waterhed
        which : string
            "user" : reference watershed (on which similarity will be based)

        Returns
        -------
        data : pandas datframe
            data loaded, normalized and smoothed
        years : vector of strings
            List of years on which similarity should be performed
            Is effectively filled only for the watershed used as reference (base of correlation)

        """
        
        variable_folder = self.variables_definition[variable]
        # Loading data (the sole location of the code where data are loaded!)
        file_path = os.path.join(data_path, variable_folder, variable, "{}.csv".format(watershed_id)) 
        with open(file_path) as file:
            data = pd.read_csv(file, index_col="t") # t as index
            data.index = pd.to_datetime(data.index) # from date in string to date in pandas time format
            data = self.__timeseries_normalization(data)
            data = self.__timeseries_smoothing(data)
        
        years = None
        
        if which == 'user':
            self.__extract_variable_parameters(variable)
            years = self.TimeProperties.get_nyears(data)
        
        return data, years
    
    
    def __timeseries_normalization(self, df):
        return (df - df.mean()) / df.std()
    
    
    #NICOLAS: sortir le paramètres "window" dans les fichiers xml
    def __timeseries_smoothing(self, df, window=1, min_periods=1):
        """
        rolling mean (mean on a moving window)

        Parameters
        ----------
        df : dataframe
            data.
        window : int
            Number of days over which smooting should be done. The default is 1.
        min_periods : int
            Minimum of observations on which sliding means is done. The default is 1.

        Returns
        -------
        smoothed dataframe
        
        """
        return df.rolling(window=window, min_periods=min_periods).mean()
    
    
    def __extract_variable_parameters(self, variable):
        time_params = self.params.getgroup(variable).getgroup("Time")
        self.TimeProperties.set_similarity_conditions(time_params)
        indicator_params = self.params.getgroup(variable).getgroup("Calculation")
        self.Indicator = IN.Indicator(indicator_params)
            
    
    def __set_similarity_period(self, df, date, variable):
        """
        Restricts data to the one of "variable" over the range [date-self.TimeProperties.ndays, date]
        
        Parameters
        ----------
        df : dataframe
            input data
        date : pandas date time
            latest date of chronicle on which correlation should be performed 
            accounts for delay "recalage" if heavy precipitations are filtered
        variable : string
            variable on which similarity should be performed

        Returns
        -------
        df : datafrem
            selcted data for the right variable and date

        """
        
        # Convert to hydrological year
        df = self.TimeProperties.convert_to_HY(df)
        
        # Period to calculate similarity of time series
        df = self.TimeProperties.similarity_period(df, date)
        
        # Convert the dataframe based on the variable-specific time step
        df = self.TimeProperties.time_step_conversion(df, variable)
        
        return df
    
    
    def __get_common_index(self, user_watershed_df, df):
        return df.index.strftime('%m-%d').intersection(user_watershed_df.index.strftime('%m-%d'))