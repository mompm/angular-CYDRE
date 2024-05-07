# -*- coding: utf-8 -*-
"""
Created on Mon Jul 17 15:35:15 2023

@author: nicol
"""

import csv
import json
import os
import unicodedata
import flask 
from flask import jsonify, render_template, request
from flask_cors import CORS, cross_origin
import pyproj
import utils.toolbox as TO
from shapely.geometry import MultiPolygon, Polygon
import geopandas as gpd
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
from shapely.geometry import mapping , Point
from datetime import datetime



chemin_absolu = os.path.abspath("api.py")
app_root = os.path.dirname(chemin_absolu)


stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")
gdf_stations['hydro_link'] = gdf_stations['ID'].apply(lambda id: f"https://www.hydro.eaufrance.fr/sitehydro/{id}/fiche")

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




piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")

app = flask.Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'




@app.route('/osur/getxmlnames', methods=['GET'])
@cross_origin()
def xmlList():
    return flask.jsonify(["cydre_inputs", "PARADIS_inputs"])

@app.route('/osur/getxml/PARADIS_inputs', methods=['GET'])
@cross_origin()
def paradis():
    xmlPath="PARADIS_A14_TRANSITION_MATRICE_1000.xml"
    return flask.send_file(xmlPath, mimetype='application/xml')

@app.route('/osur/getxml/cydre_inputs', methods=['GET'])
@cross_origin()
def cydre():
    xmlPath="cydre_params.xml"
    return flask.send_file(xmlPath, mimetype='application/xml')

@app.route('/osur/run_cydre', methods=['POST'])
@cross_origin()
def run_cydre():
    data = flask.request.get_data()
    print(data.decode())
    return flask.jsonify("all good")


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






# Chemin vers le répertoire contenant les fichiers CSV
hydrology_path = os.path.join(app_root,'data', 'hydrology')

@app.route('/osur/stationDischarge/<string:id>', methods=['GET'])
@cross_origin()
def get_stationdata(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(hydrology_path, csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
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
    
    
@app.route('/osur/GetGDFStations', methods=['GET'])
@cross_origin()
def get_GDF_STATIONS():
    json_list = []
    lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
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
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'index' : row['ID'],
            'name' : row['name'],
            'station_name' : row['station_name'],
            'hydro_link' : row['hydro_link'],
            'BSS_name' : BSS_name_value,
            'BSS_ID' : BSS_ID_value,
            'x_outlet': row['x_outlet'],
            'y_outlet': row['y_outlet'],
            'area' : row['area'],
            'geometry': geometry_geojson,

        }
        json_list.append(json_object)
    
    return json_list

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




if __name__ == '__main__':
    app.run(host='localhost')
