# -*- coding: utf-8 -*-
"""
Created on Tue May 30 14:53:12 2023

@author: Nicolas Cornette
"""

# Modules
import os
import pandas as pd

# Cydre modules
import utils.toolbox as toolbox


class HydraulicProp():
    """
    HydraulicProperty class, used to process hydraulic properties data.
    
    Parameters:
    ----------
    bh_id : str
        national hydrological station identifier (BanqueHydro).
    filename : str
        path to the file containing calibrated hs1D parameters.
    
    Attributes:
    ----------
    id : str
        national hydrological station identifier (BanqueHydro).
    params : dict
        dictionnary containing calibrated hs1D parameters
    
    Methods:
    ----------
    get_data(bh_id, filename)
        Load hydraulic properties data.
    """
    
    def __init__(self, bh_id, path):
        
        self.get_data(bh_id, path)
        
        
    def get_data(self, bh_id, path):
        """
        Load hydraulic properties data.

        Parameters
        ----------
        bh_id : str
            national hydrological station identifier (BanqueHydro).
        filename : str
            path to the file containing calibrated hs1D parameters.

        Returns
        -------
        params : dict
            dictionnary containing calibrated hs1D parameters
        """
        
        # Read csv file containing calibrated hs1D parameters
        file = os.path.join(path, 'hydraulic_properties.csv')
        data = pd.read_csv(file, sep=';', decimal=',')
        
        # Fill a dictionnary  by the id
        self.calibrated_params = {}
        self.calibrated_params['k1'] = data[data["ID"] == bh_id]['K1'].values[0]
        self.calibrated_params['theta1.d'] = data[data["ID"] == bh_id]['Theta1_d'].values[0]
        self.calibrated_params['k2'] = data[data["ID"] == bh_id]['K2'].values[0]
        self.calibrated_params['theta2.d'] = data[data["ID"] == bh_id]['Theta2_d'].values[0]
        self.calibrated_params['ratio_k2k1'] = data[data["ID"] == bh_id]['Ratio_K2K1'].values[0]
        
        # Load raw hs1D results
        raw_path = os.path.join(path, 'hs1Dresults')
        raw_data = toolbox.load_object(raw_path, bh_id)
        self.exploration_results = raw_data
