# -*- coding: utf-8 -*-
"""
Created on Mon Jul 22 16:47:44 2024

@author: Nicolas Cornette


Préparation des données pour le launcher run_cydre ou pour le serveur back-end api2.py.
2 fonctions principales:
    - Définition des répertoires.
    - Chargement des stations hydrologiques et piézométriques et des limites des bassins versants.
"""

import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from libraries.utils.toolbox import lambert93_to_wgs84


def define_paths(app_root):
    data_path = os.path.join(app_root, 'data')
    hydrometry_path = os.path.join(data_path, 'hydrometry', 'discharge')
    surfex_path = os.path.join(data_path, 'climatic', 'surfex')
    piezo_path = os.path.join(data_path, 'piezometry')
    hydraulic_path = os.path.join(data_path, 'hydraulicprop')
    output_path = os.path.join(app_root, 'outputs', 'projections')
    
    return data_path, hydrometry_path, surfex_path, piezo_path, hydraulic_path, output_path


def load_data(app_root):
    gdf_stations = __load_hydrological_stations(app_root)
    gdf_piezometry = __load_piezometric_stations(app_root)
    gdf_watersheds = __load_watersheds(app_root)

    return gdf_stations, gdf_piezometry, gdf_watersheds


def __load_hydrological_stations(app_root):
    stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
    x_wgs84, y_wgs84 = lambert93_to_wgs84(stations["x_outlet"], stations["y_outlet"])
    geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
    gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")
    
    return gdf_stations

def __load_piezometric_stations(app_root):
    piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
    geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
    gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")
    
    return gdf_piezometry

def __load_watersheds(app_root):
    gdf_watersheds = gpd.read_file(os.path.join(app_root, 'data', 'watersheds2.shp'))
    gdf_watersheds = gdf_watersheds.set_index('index')
    
    for i in gdf_watersheds.index:

        # Extraire les coordonnées des limites de la géométrie du polygone à l'index courant
        minx, miny, maxx, maxy = gdf_watersheds['geometry'].bounds.loc[i]
        
        # Créer les colonnes min_lon, min_lat, max_lon et max_lat et leur assigner les valeurs extraites
        gdf_watersheds.loc[i, 'min_lon'] = minx
        gdf_watersheds.loc[i, 'min_lat'] = miny
        gdf_watersheds.loc[i, 'max_lon'] = maxx
        gdf_watersheds.loc[i, 'max_lat'] = maxy
    
    return gdf_watersheds
