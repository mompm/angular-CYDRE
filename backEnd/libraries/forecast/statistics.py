# -*- coding: utf-8 -*-
"""
Created on Thu Sep 28 16:26:03 2023

@author: Nicolas Cornette
"""

import pandas as pd
import numpy as np
from scipy import stats


class Statistics():

    
    @staticmethod
    def ecdf(values, probabilities, quantiles):
        # ecdf only exist in scipy 1.14 version and available for python >= 3.9
        # there is no weights argument in scipy ecdf method
        ecdf = stats.ecdf(values, weights=probabilities)
        quantiles_values = ecdf.ppf(quantiles)
        return quantiles_values

    @staticmethod
    def quantile_with_weights(sample, weights, quantile):
        """Calcule le quantile d'un ensemble de données pondéré.
    
        Args:
            sample: L'ensemble de données.
            weights: Les poids associés aux données.
            quantile: Le quantile que vous souhaitez calculer.
    
        Returns:
            Le quantile de l'ensemble de données.
        """
    
        df = pd.DataFrame({'values': sample, 'weights':weights})
        df_sorted = df.sort_values(by='values').reset_index(drop=True)
        df_sorted['cum_weights'] = df_sorted['weights'].cumsum()

        row = df_sorted[df_sorted['cum_weights'] >= quantile].iloc[0]

        if row['cum_weights'] == quantile:
            Qp = row['values']
        else:
            Qp = np.interp(quantile, df_sorted['cum_weights'], df_sorted['values'])
        return Qp