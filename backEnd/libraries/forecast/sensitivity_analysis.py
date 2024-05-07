# -*- coding: utf-8 -*-
"""
Created on Wed Oct 25 16:03:28 2023

@author: nicol
"""

import numpy as np
import itertools


class SensitivityAnalysis():
    
    def __init__(self, param_names, param_ranges, num_values):
        
        self.param_names = param_names
        self.param_ranges = param_ranges
        self.num_values = num_values
        
        
    def set_parameters_values(self):
        
        self.param_values = []
        
        for i in enumerate(self.param_ranges):
            
            # int or float (linspace values)
            if isinstance(self.param_ranges[i[0]], tuple):
                min_value = i[1][0]
                max_value = i[1][1]
                values = np.linspace(min_value, max_value, self.num_values[i[0]])
                
            # string or defined values
            elif isinstance(self.param_ranges[i[0]], list):
                values = self.param_ranges[i[0]]
        
            self.param_values.append(values)
      
    
    def set_parameters_combination(self):

        combinations = list(itertools.product(*self.param_values))

        param_combinations = []
        
        for combination in combinations:
            param_combinations.append(dict(zip(self.param_names, combination)))
        
        return param_combinations