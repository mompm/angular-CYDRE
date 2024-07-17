# -*- coding: utf-8 -*-
"""
Created on Thu May 25 15:33:55 2023

@author: Nicolas Cornette
"""

import os
import requests
from io import StringIO
import pandas as pd
import datetime
from datetime import date
import json


class Piezometry():
    
    
    def __init__(self, bss_id, data_path):
        
        self.data_path = data_path
        self.stations_bss = self.__get_piezometric_stations(self.data_path)
        self.bss_id = bss_id
        self.old_bss_id = self.stations_bss[self.stations_bss['Identifiant BSS'] == self.bss_id]['Ancien code national BSS'].values[0]
        
        
    def __get_piezometric_stations(self, data_path):
        filename = 'stations.csv'
        return pd.read_csv(os.path.join(data_path, filename), delimiter=';', encoding='ISO-8859-1')
    
    
    def update_data(self, old_bss_id):
        
        self.data = self.get_data(old_bss_id)
        self.water_table_level = pd.DataFrame({'Q':self.data['H']})
        self.water_table_depth = pd.DataFrame({'Q':self.data['d']})
    
    
    def get_data(self, site):
        
        # get the current date
        end_date = pd.to_datetime(date.today()) 
        
        # api url : .json (from hub'eau)
        api_root_json = "https://hubeau.eaufrance.fr/api//v1/niveaux_nappes/chroniques"
        
        # Count number of observations (daily discharge values)
        number_url = '{a}?code_bss={s}&date_fin_mesure={end}&size=1'.format(a=api_root_json, s=site, end=end_date)
        number = json.loads(requests.get(number_url).text)['count']
        
        print(number)
        
        # api url : .csv (from hub'eau)
        api_root_csv = "https://hubeau.eaufrance.fr/api//v1/niveaux_nappes/chroniques.csv"
        
        # number of maximal observations = 20 000
        if number < 20000:
            url_api = '{a}?code_bss={code}&data_fin_mesure={end}&size={nb}'.format(a=api_root_csv, code=site, end=end_date, nb=number+1)
        else:
            start_date = end_date - datetime.timedelta(days=20000)
            url_api = '{a}?code_bss={code}&date_debut_mesure={ds}&date_fin_mesure={de}&size={nb}'.format(a=api_root_csv, s=site, ds=start_date, de=end_date, nb=20000)

         # convert to dataframe
        data = pd.read_csv(StringIO(requests.get(url_api).text), sep=";",
                            parse_dates=['date_mesure'])
        
        serie = data[['date_mesure', 'niveau_nappe_eau', 'profondeur_nappe']]
        serie = serie.set_axis(['t', 'H', 'd'], axis=1)
        serie.sort_values(by=['t'],inplace=True)
        serie = serie.set_index("t")
        
        return serie
    
    def get_correspondance_table(self, data_path):
        
        # Load correspondance tables
        stations_bss = self.__get_piezometric_stations(data_path)
        filename = 'correspondance_watershed_piezometers.csv'
        corr_table = pd.read_csv(os.path.join(data_path, filename), delimiter=';')
        
        # Add column "OLD_BSS_NAME" in the watershed correspondance table
        df_merged = pd.merge(corr_table, stations_bss, left_on='CODE_BSS', right_on='Identifiant BSS', how='left')
        correspondance_table = df_merged[['NOM_BV', 'ID_HYDRO', 'CODE_BSS', 'Ancien code national BSS', 'NOM_BSS']]
        
        return correspondance_table, stations_bss