# -*- coding: utf-8 -*-
"""
Created on Wed Oct 25 16:03:28 2023

@author: nicol
"""

import numpy as np
import itertools


class SensitivityAnalysis():
    """
    Attributes
    ----------
    param_names : list of strings
        Name of parameters, should correspond to parameter names in xml files
    param_ranges : list of different format 
        Range of parameters with either 
            - values
            - ranges
    num_values : list of integers
        Number of occurences for a given parameter
    param_values : list of values
        Values for each of the parameters
    
    Methods 
    -------
    set_parameters_values(self):
        Set parameter values with the two possibilities
    set_parameters_combination(self):
        Cartesian product of parameters
        
    """
    
    def __init__(self, param_names, param_ranges, num_values):
        
        self.param_names = param_names
        self.param_ranges = param_ranges
        self.num_values = num_values
        
        
    def set_parameters_values(self):
        """ 
        Set parameter values with the two possibilities
        - range of values and number of values: systematic sampling
        - list of values already put in parameters 
        """
        
        self.param_values = []
        
        for i in enumerate(self.param_ranges):
            
            # int or float (linspace values)
            if isinstance(self.param_ranges[i[0]], tuple):
                # tuple: 2 values (..., ...)
                min_value = i[1][0]
                max_value = i[1][1]
                values = np.linspace(min_value, max_value, self.num_values[i[0]])
                
            # string or defined values
            elif isinstance(self.param_ranges[i[0]], list):
                # list: [...,...]
                values = self.param_ranges[i[0]]
        
            self.param_values.append(values)
      
    
    def set_parameters_combination(self):
        """
        Cartesian product of parameters 
        
        Returns
        -------
        param_combinations : list of dictionary of 'zipped' parameters 
            list of parameters for each of the simulations 
        """

        combinations = list(itertools.product(*self.param_values))

        param_combinations = []
        
        for combination in combinations:
            param_combinations.append(dict(zip(self.param_names, combination)))
        
        return param_combinations