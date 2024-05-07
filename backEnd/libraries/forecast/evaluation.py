# -*- coding: utf-8 -*-
"""
Created on Fri Oct 20 09:40:07 2023

@author: Nicolas Cornette
"""

import numpy as np
import pandas as pd
import math


class Evaluation():
    
    """
    Class for evaluating the predictive quality of streamflow projections with a similarity analysis approach.

    Attributes:
    - sim (numpy array): Projected streamflow data.
    - obs (numpy array): Observed streamflow data.

    Methods:
    - nse: Nash-Sutcliffe Efficiency (NSE) calculation.
    - nselog: Nash-Sutcliffe Efficiency for log-transformed data.
    - nseinv: Nash-Sutcliffe Efficiency for inverse-transformed data.
    - kge: Kling-Gupta Efficiency (KGE) calculation.
    - rmse: Root Mean Square Error (RMSE) calculation.
    """
    
    def __init__(self, sim, obs):
        
        """
        Initialize the Evaluation object with simulated and observed streamflow data.

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.
        """
        
        self.sim = sim
        self.obs = obs
        
        
    def model_performance(self):
        
        nse = self.nse(self.sim, self.obs)
        nselog = self.nselog(self.sim, self.obs)
        nseinv = self.nseinv(self.sim, self.obs)
        nse = self.nse(self.sim, self.obs)
        kge = self.kge(self.sim, self.obs)
        rmse = self.rmse(self.sim, self.obs)
        mse = self.mse(self.sim, self.obs)
        
        performance = pd.DataFrame({'nse':[nse], 'nselog':[nselog], 'nseinv':[nseinv],
                                    'kge':[kge], 'rmse':[rmse], 'mse':[mse]})
        
        return performance
    

    def nse(self, sim, obs):
        
        """
        Calculate Nash-Sutcliffe Efficiency (NSE).

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Nash-Sutcliffe Efficiency (NSE) value.
        """
        
        nse = 1 - np.sum((obs - sim)**2) / np.sum((obs - np.mean(obs))**2)
        
        return nse
    
    def nselog(self, sim, obs):
        
        """
        Calculate Nash-Sutcliffe Efficiency (NSE) for log-transformed data.

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Nash-Sutcliffe Efficiency (NSE) value for log-transformed data.
        """
        
        moy_obs = np.log10(obs)[~np.isinf(np.log10(obs))].mean()
            
        nselog = 1 - np.ma.masked_invalid((np.log10(obs)-np.log10(sim))**2).sum()/np.ma.masked_invalid((np.log10(obs)-moy_obs)**2).sum()
        
        return nselog
    
    def nseinv(self, sim, obs):
        
        """
        Calculate Nash-Sutcliffe Efficiency (NSE) for inverse-transformed data.

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Nash-Sutcliffe Efficiency (NSE) value for inverse-transformed data.
        """
        
        moy_obs = (1/obs)[~np.isinf(1/obs)].mean()
           
        nseinv = 1 - np.ma.masked_invalid(((1/obs)-(1/sim))**2).sum()/np.ma.masked_invalid(((1/obs)-moy_obs)**2).sum()
        
        return nseinv
    
    def kge(self, sim, obs):
        
        """
        Calculate Kling-Gupta Efficiency (KGE).

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Kling-Gupta Efficiency (KGE) value.
        """
        
        # linear correlation between observations and simulations
        # Pearson's correlation coefficient
        r_num = np.sum((sim - np.mean(sim)) * (obs - np.mean(obs)))
        
        r_den = np.sqrt(np.sum((sim - np.mean(sim))**2) * np.sum((obs - np.mean(obs))**2))
        
        r = r_num/r_den
        
        # flow variability error
        # standard-deviation_sim/standard-deviation_obs
        # sigma_sim/sigma_obs
        alpha = np.std(sim) / np.std(obs)
        
        # Bias term
        # simulation mean / observation_mean 
        # mu_sim/mu_obs
        beta = np.mean(sim) / np.mean(obs)
        
        # KGE
        ED = math.sqrt((r-1)**2 + (alpha-1)**2 + (beta-1)**2)
        
        kge = 1 - ED
        
        return kge
    
    def rmse(self, sim, obs):
        
        """
        Calculate Root Mean Square Error (RMSE).

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Root Mean Square Error (RMSE) value.
        """
        
        rmse = np.sqrt(np.mean((obs - sim) ** 2))
        
        return rmse
    
    
    def mse(self, sim, obs):
        """
        Calculate Mean Squared Error (MSE).

        Parameters:
        - sim (numpy array): Simulated streamflow data.
        - obs (numpy array): Observed streamflow data.

        Returns:
        - float: Mean Squared Error (MSE) value.
        """
        mse = np.mean((obs - sim)**2)
        return mse