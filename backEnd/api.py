# -*- coding: utf-8 -*-
"""
Created on Mon Jul 17 15:35:15 2023

@author: nicol
"""

# Python modules
import os
import csv
import pandas as pd
import geopandas as gpd
import pyproj
from shapely.geometry import mapping , Point
import flask 
from flask import jsonify
from flask_cors import CORS, cross_origin


# Application path
app_root = os.path.dirname(os.path.abspath("api.py"))
hydrometry_path = os.path.join(app_root,'data', 'hydrometry')
surfex_path = os.path.join(app_root, 'data', 'climatic', 'surfex')
piezometry_path = os.path.join(app_root, 'data', 'piezometry')


# -- Read hydrological and piezometric stations csv files and watersheds boundaries

# Hydrological stations
stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

# Piezometric stations
piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")

# Watershed boundaries
gdf_watersheds = gpd.read_file(os.path.join(app_root, 'data', 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')

for i in gdf_watersheds.index:

    # Extraire les coordonnées des limites de la géométrie du polygone à l'index courant
    minx, miny, maxx, maxy = gdf_watersheds['geometry'].bounds.loc[i]
    
    # Créer les colonnes min_lon, min_lat, max_lon et max_lat et leur assigner les valeurs extraites
    gdf_watersheds.loc[i, 'min_lon'] = minx
    gdf_watersheds.loc[i, 'min_lat'] = miny
    gdf_watersheds.loc[i, 'max_lon'] = maxx
    gdf_watersheds.loc[i, 'max_lat'] = maxy


# -- Run Flask back-end application

# Configuration
app = flask.Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

@app.route('/osur/getoldBSS', methods=['GET'])
@cross_origin()
def get_oldBSS():
   # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/piezometry/stations.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=';')
        for row in csv_reader:
            json_object = {
                'X_WGS84': row['X_WGS84'],
                'Y_WGS84': row['Y_WGS84'],
                'Identifiant_BSS': row['Identifiant BSS'],
                'Ancien_code_national_BSS': row['Ancien code national BSS']
            }
            json_list.append(json_object)

    return json_list

# gdf_stations conversion in a json format
@app.route('/osur/GetGDFStations', methods=['GET'])
@cross_origin()
def get_GDF_STATIONS():

    json_list = []
    
    for index, row in gdf_stations.iterrows():
        
        row['x_outlet'], row['y_outlet'] = lambert93_to_wgs84.transform(row["x_outlet"], row['y_outlet'] )
        geometry_geojson = mapping(row.geometry)
        
        BSS_ID_value = row['BSS_ID']
        if isinstance(BSS_ID_value, str) :
            BSS_ID_value = BSS_ID_value;        
        else:
            BSS_ID_value = ''
            
        BSS_name_value = row['BSS_name']
        if isinstance(BSS_name_value, str) :
            BSS_name_value = BSS_name_value;        
        else:
            BSS_name_value = ''
        
        # Convert gdf_stations to a json object
        json_object = {
            'index' : row['ID'],
            'name' : row['name'],
            'station_name' : row['station_name'],
            'BSS_name' : BSS_name_value,
            'BSS_ID' : BSS_ID_value,
            'x_outlet': row['x_outlet'],
            'y_outlet': row['y_outlet'],
            'area' : row['area'],
            'geometry': geometry_geojson,

        }
    
        json_list.append(json_object)
    
    return json_list


# gdf_piezometry conversion in a json format
@app.route('/osur/getGDFPiezometry', methods=['GET'])
@cross_origin()
def get_GDF_Piezometry():

    json_list = []

    for index, row in gdf_piezometry.iterrows():
        
        geometry_geojson = mapping(row.geometry)
        nom_value = row['Nom']
        
        if isinstance(nom_value, str) :
            nom_value = nom_value;        
        else:
            nom_value = ''
        
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'identifiant_BSS' : row['Identifiant BSS'],
            'x_wgs84':row['X_WGS84'],
            'y_wgs84':row['Y_WGS84'],
            'Nom' : nom_value,
            'oldBSS': row['Ancien code national BSS'],
            'geometry': geometry_geojson,
        }
       
        json_list.append(json_object)
    
    return json_list


# A supprimer à moyen terme car l'ID BSS est déjà présent dans gdf_stations ce qui permet d'éviter d'utiliser trop de fichiers
@app.route('/osur/getcorrespondanceBSS', methods=['GET'])
@cross_origin()
def get_correspondanceBSS():
   # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/piezometry/correspondance_watershed_piezometers.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=';')
        for row in csv_reader:
            json_object = {
                'NOM_BV': row['NOM_BV'],
                'ID_HYDRO': row['ID_HYDRO'],
                'CODE_BSS': row['CODE_BSS'],
                'TEMPS_RECESS': row['TEMPS_RECESS']
            }
            json_list.append(json_object)
    return json_list


# gdf_watersheds conversion in a json format
@app.route('/osur/GetGDFWatersheds', methods=['GET'])
@cross_origin()
def get_GDF_Watersheds():
    
    json_list = []

    for index, row in gdf_watersheds.iterrows():
    
        geometry_geojson = mapping(row.geometry)
        k1_value = row['K1']
    
        if isinstance(k1_value, str) and k1_value== 'NaN':
            k1_value = float(0)        
        else:
            k1_value = float(k1_value)
    
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'index' : index,
            'name' : row['name'],
            'geometry_a' : row['geometry_a'],
            'hydro_area' : row['hydro_area'],
            'K1': k1_value,
            'geometry': geometry_geojson,
            'min_lon':row['min_lon'],
            'min_lat':row['min_lat'],
            'max_lon':row['max_lon'],
            'max_lat':row['max_lat'],
        }
    
        json_list.append(json_object)
    
    return json_list


# Get discharge timeseries
@app.route('/osur/stationDischarge/<string:id>', methods=['GET'])
@cross_origin()
def get_stationdata(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(hydrometry_path, 'discharge', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'Q': row['Q']
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404


# Get temperature timeseries
@app.route('/osur/stationTemperature/<string:id>', methods=['GET'])
@cross_origin()
def get_temperature(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(surfex_path, 'temperature', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'Q': row['Q']
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404
    

# Get precipitation timeseries
@app.route('/osur/stationPrecipitation/<string:id>', methods=['GET'])
@cross_origin()
def get_precipitation(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(surfex_path, 'precipitation', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'Q': row['Q']
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404
    

# Get water-table depth timeseries
@app.route('/osur/stationWaterTableDepth/<string:id>', methods=['GET'])
@cross_origin()
def get_water_table_depth(id):

    bss_id = []

    # Initialiser une liste pour stocker les données JSON
    id_upper = id.upper()
    for i in gdf_stations.index:
        if gdf_stations.loc[i, 'ID'] == id_upper:
            station_name = gdf_stations.loc[i, 'station_name']
            bss_id = gdf_stations.loc[i, 'BSS_ID']

    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{bss_id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(piezometry_path, csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            
            # Initialiser une liste pour stocker les données JSON
            json_list = []
            json_list.append(station_name)
            json_list.append(bss_id)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'H': row['H'],
                        'd': row['d'],
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404


if __name__ == '__main__':
    app.run(host='localhost')
