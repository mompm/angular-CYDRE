# -*- coding: utf-8 -*-
"""
Created on Fri Sep 22 13:57:06 2023

@author: nicol
"""

import pandas as pd
import numpy as np
import scipy
import math
from scipy.stats import rankdata
from sklearn.preprocessing import StandardScaler
from dtaidistance import dtw, similarity


class Indicator():
    
    
    def __init__(self, params):
    
        self.params = params
        
    
    def calculate_similarity(self, ref_df, comp_df):
        
        # select the algorithm calculation associated to the variable
        # /!\ need to test the timseries stationnarity /!\
        # /!\ apply standardization ? /!\
        # /!\ moving average ? /!\
        self.metric = self.params.getparam("metric").getvalue()
        self.x = ref_df.values
        self.y = comp_df.values
        self.w = np.array((ref_df.index - ref_df.index.min()).days / (ref_df.index.max() - ref_df.index.min()).days)

        
        # Timeseries normalization
        # Normalement pas d'influence car mêmes échelles et unités
        # Pourrait être intéressant dans le cas où l'indicateur n'est pas nécessairement entre -1 et 1 comme le DTW ?
        #ref_df, comp_df = self._series_normalization(ref_df, comp_df)
        
        # Indicator calculation
        if self.metric == "pearson":
            coeff = self.pearson(ref_df, comp_df)
        
        elif self.metric == 'spearman':
            coeff = self.spearman(ref_df, comp_df)
        
        elif self.metric == "dtw":
            # Is it possible to normalize DTW ? (close to 0 good similarity, high values dissimilarity)
            #coeff = self.dynamic_time_wrapping(ref_df, comp_df)
            coeff = self.dtw(ref_df, comp_df)
        
        elif self.metric == "nse":
            coeff = self.nse(comp_df, ref_df)
            
        return coeff
    
    
    def _series_normalization(self, ref_df, comp_df):
        scaler = StandardScaler()
        ref_df_normalized = scaler.fit_transform(ref_df.values.reshape(-1, 1))
        ref_df_normalized = pd.Series(ref_df_normalized.flatten(), index=ref_df.index, name='Q')
        comp_df_normalized = scaler.fit_transform(comp_df.values.reshape(-1, 1))
        comp_df_normalized = pd.Series(comp_df_normalized.flatten(), index=comp_df.index, name='Q')
        return ref_df_normalized, comp_df_normalized
    
    
    def model_performance(self, sim, obs):
        
        nselog = self.nselog(sim, obs)
        nse = self.nse(sim, obs)
        kge = self.kge(sim, obs)
        rmse = self.rmse(sim, obs)
        pearson = self.pearson(obs, sim)
        spearman = self.spearman(obs, sim)
        dtw = self.dtw(obs, sim)
        
        performance = pd.DataFrame({'nse':[nse], 'nselog':[nselog], 'kge':[kge], 'rmse':[rmse],
                                    'pearson':[pearson], 'spearman':[spearman], 'dtw':[dtw]})
        
        return performance
    
    
    def pearson(self, ref_df, comp_df, weight=False):
        """Weighted Pearson correlation"""
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
            
        if weight:
            corr = self._weighted_cov(x, y, self.w) / np.sqrt(self._weighted_cov(x, x, self.w) * self._weighted_cov(y, y, self.w))
        else:
            corr = scipy.stats.pearsonr(x, y)[0]
            
        return corr
    
    
    def spearman(self, ref_df, comp_df, weight=False):
        """Weighted Spearman correlation"""
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
            
        if weight:
            rank_x = rankdata(x)
            rank_y = rankdata(y)
            sum_squared_diff = self._weighted_rank_diff(rank_x, rank_y, self.w)
            n = len(x)
            corr = 1 - (6 * sum_squared_diff) / (n * (n**2 - 1))
        else:    
            corr = scipy.stats.spearmanr(x, y)[0]
        return corr
    
    
    def dtw(self, ref_df, comp_df):
        """Dynamic Time Wrapping"""
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
            
        distance = dtw.distance(x, y)
        corr = (1 / (0.5 + (0.3 * distance))) / 2
        #corr = similarity.distance_to_similarity(distance)
        return corr


    def nse(self, comp_df, ref_df):
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
        
        nse = 1 - np.sum((x - y)**2) / np.sum((x - np.mean(x))**2)
        
        return nse


    def nselog(self, comp_df, ref_df):
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
        
        moy_obs = np.log10(x)[~np.isinf(np.log10(x))].mean()
            
        nselog = 1 - np.ma.masked_invalid((np.log10(x)-np.log10(y))**2).sum()/np.ma.masked_invalid((np.log10(x)-moy_obs)**2).sum()
        
        return nselog


    def nseinv(self, sim, obs):
        
        sim = sim.values
        obs = obs.values
        
        moy_obs = (1/obs)[~np.isinf(1/obs)].mean()
           
        nseinv = 1 - np.ma.masked_invalid(((1/obs)-(1/sim))**2).sum()/np.ma.masked_invalid(((1/obs)-moy_obs)**2).sum()
        
        return nseinv


    def kge(self, comp_df, ref_df):
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
    
        # linear correlation between observations and simulations
        # Pearson's correlation coefficient
        r_num = np.sum((y - np.mean(y)) * (x - np.mean(x)))
        
        r_den = np.sqrt(np.sum((y - np.mean(y))**2) * np.sum((x - np.mean(x))**2))
        
        r = r_num/r_den
        
        # flow variability error
        # standard-deviation_sim/standard-deviation_obs
        # sigma_sim/sigma_obs
        alpha = np.std(y) / np.std(x)
        
        # Bias term
        # simulation mean / observation_mean 
        # mu_sim/mu_obs
        beta = np.mean(y) / np.mean(x)
        
        # KGE
        ED = math.sqrt((r-1)**2 + (alpha-1)**2 + (beta-1)**2)
        
        kge = 1 - ED
        
        return kge


    def rmse(self, comp_df, ref_df):
        
        if isinstance(comp_df, np.ndarray):
            x = ref_df
            y = comp_df
        elif isinstance(comp_df, pd.Series):
            x = ref_df.values
            y = comp_df.values
        
        rmse = np.sqrt(np.mean((x - y) ** 2))
        
        return rmse

    
    def _weighted_mean(self, x, w):
        """Weighted Mean"""
        return np.sum(x * w) / np.sum(w)
    
    
    def _weighted_cov(self, x, y, w):
        """Weighted Covariance"""
        return np.sum(w * (x - self._weighted_mean(x, w)) * (y - self._weighted_mean(y, w))) / np.sum(w)
    
    
    def _weighted_rank_diff(self, rank_x, rank_y, w):
        weighted_rank_diff = w * (rank_x - rank_y)
        return np.sum(weighted_rank_diff**2)