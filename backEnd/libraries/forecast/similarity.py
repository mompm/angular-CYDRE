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
        self.correlation_matrix = {}
        
        
    def spatial_similarity(self, watersheds):
        
        _result_df = self._join_hs1D_results(watersheds, parameters=['K1', 'D', 'K2/K1'])
        self.clusters = self._watershed_clustering(_result_df)
        self.watershed_similarity = self._watershed_similarity(_result_df)
        
        for ws in self.clusters.index:
            watersheds[ws]['typology'] = int(self.clusters.loc[ws].typology)
    
    
    def _join_hs1D_results(self, watersheds, parameters):
        
        # Join all calibrated modeled results in one dictionnary
        hs1d_results = {}
        
        for ws in watersheds.keys():
            
            try:
                watershed_exploration = watersheds[ws]['hydraulicprop']['results']
                hs1d_results[ws] = watershed_exploration
            except:
                #print(f"There is no exploration results for the watershed: {ws}")
                pass

        # Prepare watershed clustering 
        concatenated_df = pd.concat(hs1d_results.values(), keys=hs1d_results.keys())
        result_df = concatenated_df.loc[(slice(None), parameters), 'median']
        result_df = result_df.unstack(level=1)
        result_df = np.log10(result_df)
        
        return result_df
    
        
    def _watershed_clustering(self, df):
        
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
        
    
    def _watershed_similarity(self, df):
        
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
        print(self.similar_watersheds)
    
    def timeseries_similarity(self, user_watershed, watersheds, version, similar_watersheds):
        
        """
        Calculate temporal similarity between the user-selected watershed and regional historical watersheds.
        """
                
        # Keep only watersheds that share the same typology
        try:
            watersheds = {key: value for key, value in watersheds.items() if key in similar_watersheds}
        except:
            pass
         
        for variable in self.variables:
                        
            # Storing the variable correlation matrix in a dataframe
            var_corr_matrix = pd.DataFrame()
            
            # Time series serving as a reference for the selected variable.
            user_watershed_df, years = self._timeseries_preprocessing(user_watershed,
                                                                       variable,
                                                                       self.TimeProperties,
                                                                       version,
                                                                       which='user')
            user_watershed_df = self._set_similarity_period(user_watershed_df, self.TimeProperties.date, variable)
            self.user_similarity_period = self.TimeProperties._similarity_period
            
            for comp_watershed_id, comp_watershed in watersheds.items():
                try:
                    # Storing the correlation coefficients and years in a list
                    similarity_coefficients = []
                    similarity_years = []
                    
                    #  Time series serving as a comparison for the selected variable
                    comp_watershed_df, _ = self._timeseries_preprocessing(comp_watershed,
                                                                       variable,
                                                                       self.TimeProperties,
                                                                       version,
                                                                       which='comparison')
                    for year in years:                        

                        df = self._set_similarity_period(comp_watershed_df, year, variable)
        
                        try:
                            # ----- SIMILARITY CALCULATION -----
                            common_indexes = self._get_common_index(user_watershed_df, df)
                            comp_serie = df.Q[df.Q.index.strftime('%m-%d').isin(common_indexes)]
                            
                            similarity = self.Indicator.calculate_similarity(user_watershed_df.Q, comp_serie)
                            similarity_coefficients.append(similarity)
                            similarity_years.append(year.year)
                            # ----- SIMILARITY CALCULATION -----
                        except Exception as e:
                            print(f"Error processing year {year}, watershed {comp_watershed['hydrometry']['name']}, variable {variable}: {e}")
                    
                    # Fill the variable correlation matrix
                    tmp_matrix = pd.DataFrame(similarity_coefficients, index=similarity_years)
                    tmp_matrix.columns = [comp_watershed_id]
                    var_corr_matrix = pd.concat([var_corr_matrix, tmp_matrix], axis=1, sort=True)
                
                except Exception as e:
                    print(f"Error processing watershed {comp_watershed['hydrometry']['name']}, variable {variable}: {e}")
            
            # Store all variable correlation matrix in the general results dictionary
            self.correlation_matrix[variable] = var_corr_matrix
    
            
    def _timeseries_preprocessing(self, watershed, variable, time_properties, version, which):
                
        self.preprocessor = PR.PreProcessor(watershed, time_properties)
        self.preprocessor.preprocess_watershed_data(variable)
        df = self.preprocessor.df
        
        years = None
        
        if which == 'user':
            self._extract_variable_parameters(variable)
            years = self.TimeProperties.get_nyears(df)
        
        return df, years
    
    
    def _extract_variable_parameters(self, variable):
        time_params = self.params.getgroup(variable).getgroup("Time")
        self.TimeProperties.set_similarity_conditions(time_params)
        indicator_params = self.params.getgroup(variable).getgroup("Calculation")
        self.Indicator = IN.Indicator(indicator_params)
            
        
    def _set_similarity_period(self, df, date, variable):
        
        user_watershed_df = self.preprocessor.set_similarity_period(df, date, variable)
    
        return user_watershed_df
    
    
    def _get_common_index(self, user_watershed_df, df):
        return df.index.strftime('%m-%d').intersection(user_watershed_df.index.strftime('%m-%d'))

    
    def plot_correlation_chronicles(self, user_watershed_df, user_watershed, df,
                                    comp_watershed, year, watersheds, variable, score):
        
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        plt.figure(figsize=(12, 8))
        
        # Labels
        user_legend = f'{user_watershed.hydrometry.name} - {self.TimeProperties.date.year}'
        comp_legend = f'{comp_watershed.hydrometry.name} - {year}'
        
        # Plot the data on the first subplot with a linear scale
        plt.subplot(2, 1, 1)
        plt.plot(user_watershed_df.index, user_watershed_df, color='navy', label=user_legend, linewidth=2)
        plt.plot(user_watershed_df.index, df, color='red', label=comp_legend)
        if variable == 'specific_discharge' or variable == 'recharge':
            plt.ylabel('Flow (m/s)', fontsize=18)
        elif variable == 'water_table_depth':
            plt.ylabel('Depth (m)', fontsize=18)
        plt.tick_params(axis='both', labelsize=16)
        plt.xticks([])
        plt.legend(fontsize=14)
        plt.title(variable, fontsize=20)
    
        # Add legend with watershed names and correlation coefficient
        #plt.text(0.10, 0.90, f'Coefficient: {score:.2f}', transform=plt.gca().transAxes,
         #        ha='center', va='top', color='black', fontsize=16,
          #       bbox=dict(facecolor='white', edgecolor='white', boxstyle='round,pad=0.5'))
    
        # Plot the data on the second subplot with a logarithmic scale
        plt.subplot(2, 1, 2)
        plt.plot(user_watershed_df.index, user_watershed_df, color='navy', label=user_legend, linewidth=2)
        plt.plot(user_watershed_df.index, df, color='red', label=comp_legend)
        plt.yscale('log')  # Set y-axis to logarithmic scale
        if variable == 'specific_discharge' or variable == 'recharge':
            plt.ylabel('Flow (m/s)', fontsize=18)
        elif variable == 'water_table_depth':
            plt.ylabel('Depth (m)', fontsize=18)
        plt.tick_params(axis='both', labelsize=16)
        date_formatter = mdates.DateFormatter('%m-%d')
        plt.gca().xaxis.set_major_formatter(date_formatter)
        #plt.xticks(selected_ticks, selected_ticks.strftime('%m-%d'), rotation=45, ha='right')
        
        # Adjust layout to prevent overlapping
        plt.tight_layout()
    
        # Show the plot
        filename = str(round(score,2))+'_'+comp_watershed.watershed_id+'_'+str(year)+'.tiff'
        folder = os.path.join(os.getenv("CYDRE"), "Cydre", "test", "sim_analysis", variable)
        #if score > 0.5:
        plt.savefig(os.path.join(folder, filename), dpi=100, format="tiff", bbox_inches='tight', pad_inches=0.1)
