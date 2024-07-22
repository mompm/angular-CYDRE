# -*- coding: utf-8 -*-
"""
Created on Thu Sep 28 16:45:08 2023

@author: Nicolas Cornette
"""


import numpy as np
import pandas as pd


class Selection():
    
    """
    Class used to select cells in the correlation matrix.
    
    Attributes
    ----------
    select_method: string
        selection_method for extracting top scenarios from the correlation matrix
            minimal_threshold   : takes a minimal threshold for the correlation
            maximal_percentage  : takes as a percentage the closest scenarios
            n_scenarios         : takes a number of scenarios
    __minimal_threshold_value: double
        minimum threshold for extracting top scenarios from the correlation matrix
    __maximal_percentage_value: double
        maximal_percentage for extracting top scenarios from the correlation matrix
    __n_scenarios_value: int 
        Number of top scenarios from the correlation matrix

    Methods
    -------
    filter_with_threshold(self, correlation_matrix)
        selects the closest scenarios in the sense of one of the three previous selection criteria
    
    """
    
    def __init__(self, params):
        
        #NICOLAS: supprimer params des attributs si non utilisé ailleurs. 
        self.params = params
        self.select_method = params.getparam("selection_method").getvalue()
        self.__minimal_threshold_value = params.getparam("minimal_threshold").getvalue()
        self.__maximal_percentage_value =params.getparam("maximal_percentage").getvalue()
        self.__n_scenarios_value = int(params.getparam("n_scenarios").getvalue())

        #NICOLAS: le paramètre scale dans les fichiers xml ne semble plus utiliser. Si confirmer, le supprimer des xml. 
    
    #NICOLAS: fonction plus utilisée? Supprimer? 
    def filter_with_similar_watersheds(self, correlation_matrix, similar_watersheds):
        return correlation_matrix[similar_watersheds]
    
    
    def filter_with_threshold(self, correlation_matrix):
        
        if self.select_method == 'minimal_threshold':
            filter_matrix = self.__minimal_threshold(correlation_matrix, self.__minimal_threshold_value)
            n_values = filter_matrix.count().sum()
            if n_values < 10:
                filter_matrix = self.__maximal_percentage(correlation_matrix, self.__maximal_percentage_value)
                n_values = filter_matrix.count().sum()
                if n_values < 10:
                    filter_matrix = self.__n_scenarios(correlation_matrix, self.__n_scenarios_value)
            
        elif self.select_method == 'maximal_percentage':
            filter_matrix = self.__maximal_percentage(correlation_matrix, self.__maximal_percentage_value)
            n_values = filter_matrix.count().sum()
            if n_values < 10:
                filter_matrix = self.__n_scenarios(correlation_matrix, self.__n_scenarios_value)
        
        elif self.select_method == 'n_scenarios':
            filter_matrix = self.__n_scenarios(correlation_matrix, self.__n_scenarios_value)
        
        return filter_matrix

    
    def __minimal_threshold(self, correlation_matrix, min_thresh):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        correlation_matrix = correlation_matrix.where(correlation_matrix >= min_thresh, np.nan)
        return correlation_matrix
    
    
    def __maximal_percentage(self, correlation_matrix, max_percentage):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        value_max = np.nanmax(correlation_matrix)
        min_thresh = max_percentage * value_max
        correlation_matrix = correlation_matrix.where(correlation_matrix >= min_thresh, np.nan)
        return correlation_matrix
    
    
    def __n_scenarios(self, correlation_matrix, n_best_sce):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        top_values = correlation_matrix.unstack().nlargest(n_best_sce)
        mask = correlation_matrix.apply(lambda x: x.isin(top_values))
        correlation_matrix[~mask] = np.nan
        return correlation_matrix


    @staticmethod
    def drop_target_scenarios(corr_matrix, target_year, target_watershed):
        # Exclude the same watershed for the same year
        corr_matrix.at[target_year, target_watershed] = np.nan
        corr_matrix.loc[target_year, :] = np.nan
        return corr_matrix


    @staticmethod
    def matrix_combinations(selected_scenarios):
        dfs = list(selected_scenarios.values())
        
        sum_df = pd.DataFrame(index=dfs[0].index, columns=dfs[0].columns)
        for df in dfs:
            sum_df = sum_df.add(df, fill_value=0)
        
        average_df = sum_df / len(dfs)
        
        average_df = average_df.apply(pd.to_numeric, errors='coerce')
        return average_df
    
    #NICOLAS: méthode utilisée à un seul endroit, utiliser directement stack dans cydre sans repasser par ici
    def group_scenarios(self, scenarios):
        return scenarios.stack() 