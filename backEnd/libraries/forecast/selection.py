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
    """
    
    def __init__(self, params):
        
        self.params = params
        self.select_method = self.params.getparam("selection_method").getvalue()
        self._minimal_threshold_value = self.params.getparam("minimal_threshold").getvalue()
        self._maximal_percentage_value = self.params.getparam("maximal_percentage").getvalue()
        self._n_scenarios_value = int(self.params.getparam("n_scenarios").getvalue())

    
    def filter_with_similar_watersheds(self, correlation_matrix, similar_watersheds):
        return correlation_matrix[similar_watersheds]
    
    
    def filter_with_threshold(self, correlation_matrix):
        
        if self.select_method == 'minimal_threshold':
            filter_matrix = self.minimal_threshold(correlation_matrix, self._minimal_threshold_value)
            n_values = filter_matrix.count().sum()
            if n_values < 10:
                filter_matrix = self.maximal_percentage(correlation_matrix, self._maximal_percentage_value)
                n_values = filter_matrix.count().sum()
                if n_values < 10:
                    filter_matrix = self.n_scenarios(correlation_matrix, self._n_scenarios_value)
            
        elif self.select_method == 'maximal_percentage':
            filter_matrix = self.maximal_percentage(correlation_matrix, self._maximal_percentage_value)
            n_values = filter_matrix.count().sum()
            if n_values < 10:
                filter_matrix = self.n_scenarios(correlation_matrix, self._n_scenarios_value)
        
        elif self.select_method == 'n_scenarios':
            filter_matrix = self.n_scenarios(correlation_matrix, self._n_scenarios_value)
        
        return filter_matrix

    
    def minimal_threshold(self, correlation_matrix, min_thresh):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        correlation_matrix = correlation_matrix.where(correlation_matrix >= min_thresh, np.nan)
        return correlation_matrix
    
    
    def maximal_percentage(self, correlation_matrix, max_percentage):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        value_max = np.nanmax(correlation_matrix)
        min_thresh = max_percentage * value_max
        correlation_matrix = correlation_matrix.where(correlation_matrix >= min_thresh, np.nan)
        return correlation_matrix
    
    
    def n_scenarios(self, correlation_matrix, n_best_sce):
        correlation_matrix = correlation_matrix.where(correlation_matrix != 1, np.nan)
        top_values = correlation_matrix.unstack().nlargest(n_best_sce)
        mask = correlation_matrix.apply(lambda x: x.isin(top_values))
        correlation_matrix[~mask] = np.nan
        return correlation_matrix


    @staticmethod
    def drop_target_scenarios(corr_matrix, target_year, target_watershed):
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
    
    def group_scenarios(self, scenarios):
        return scenarios.stack() 