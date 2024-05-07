# -*- coding: utf-8 -*-
"""
Created on Thu Jun 15 17:06:23 2023

@author: Nicolas Cornette
"""

class Variables():
    
    def __init__(self):
        """
        DESCRIPTION.

        Returns
        -------
        None.

        """
        
        self.scalars = ['hydraulicprop', 'geology']
        self.chronicles = ['hydrometry', 'climatic', 'piezometry']
        self.variables_definition = {'specific_discharge': 'hydrometry',
                          'recharge': 'climatic',
                          'runoff': 'climatic',
                          'water_table_depth':'piezometry'}
    
    def get_variable_type(self, variable):
        """
        DESCRIPTION.

        Parameters
        ----------
        var : TYPE
            DESCRIPTION.

        Returns
        -------
        TYPE
            DESCRIPTION.

        """
        if variable in self.variables_definition:
            return self.variables_definition[variable]
        else:
            raise ValueError("The specified variable is not supported.")
        