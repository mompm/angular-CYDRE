# -*- coding: utf-8 -*-
"""
Created on Mon Jul 17 15:35:15 2023

@author: nicol
"""

# Python modules
import os
import csv
import json
import os
from sre_constants import IN
import threading
import time
import unicodedata
import uuid
import flask 
from flask import Response, jsonify, render_template, request, stream_with_context
from flask_cors import CORS, cross_origin
from flask_sqlalchemy import SQLAlchemy
import pymysql
import pyproj
import sqlalchemy
# from launchers.run_interface import update_cydre_simulation
import utils.toolbox as TO
from shapely.geometry import MultiPolygon, Polygon
import geopandas as gpd
import pyproj
from shapely.geometry import mapping , Point
from werkzeug.security import generate_password_hash, check_password_hash

import flask 
from flask import jsonify
from flask_cors import CORS, cross_origin
from launchers.setup_cydre_path import setup_cydre_path
import libraries.forecast.initialization as IN
import libraries.forecast.outputs as OU
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px





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
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:diverse35@localhost/cydre'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)




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
        
class Users(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    role = db.Column(db.Enum('acteur de l\'eau', 'scientifique','dev'), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        salted_password = 'jaimelegateau' + password
        return check_password_hash(self.password_hash, salted_password)
    
@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()

    # Vérifier si tous les champs requis sont présents
    if not data or 'username' not in data or 'password' not in data or 'role' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    # Vérifier si l'utilisateur existe déjà
    existing_user = Users.query.filter_by(username=data['username']).first()
    if existing_user is not None:
        return jsonify({'error': 'User with this username already exists'}), 409

    # Hacher le mot de passe
    hashed_password = generate_password_hash('jaimelegateau'+ data['password'])

    # Créer un nouvel utilisateur
    new_user = Users(username=data['username'], password=hashed_password, role=data['role'])


    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database error: ' + str(e)}), 500

@app.route('/users', methods=['GET'])
def get_users():
    users = Users.query.all()
    output = [{'username': user.username, 'role': user.role} for user in users]
    return jsonify(output)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Requête pour obtenir l'utilisateur par nom d'utilisateur
    user = Users.query.filter_by(username=username).first()

    if user and check_password_hash(user.password, password):
        return jsonify({"username": username, "role": user.role}), 200
    return jsonify({"error": "Invalid credentials"}), 401

import libraries.forecast.initialization as INI

results_storage = {}

@app.route('/api/run_cydre', methods=['POST'])
def get_run_cydre():
    data = request.json
    task_id = str(uuid.uuid4())
    print("########\nInitialisation de l'app\n########")

    try:
        # Récupérer les données de la payload
        watershed = data.get('watershed')

        slider = data.get('slider')

        date = data.get('date')
        
        init = INI.Initialization(app_root)
        
        cydre_app = init.cydre_initialization()

        param_names = ['user_watershed_id', 'user_horizon', 'date']
        param_paths = init.get_parameters_path(param_names)
        init.params.find_and_replace_param(param_paths[0], watershed)
        init.params.find_and_replace_param(param_paths[1], int(slider))
        init.params.find_and_replace_param(param_paths[2], str(date))

        print("########\Création de l'app\n########")
        cydre_app = init.create_cydre_app()
        
        watershed_name = stations[stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]

        with app.app_context():
            app.config['cydre_app'] = cydre_app
            app.config['watershed_name'] = watershed_name
        results_storage[task_id] = {"task_id": task_id}

        return jsonify({"task_id":task_id}), 200

    except Exception as e:
        app.logger.error('Error starting cydre_app: %s', str(e))
        return jsonify({'error': str(e)}), 500      
    
@app.route('/api/run_spatial_similarity', methods=['POST'])
def run_spatial_similarity():
    try:
        app.config['cydre_app'].run_spatial_similarity(spatial=True)
    except Exception as e:
        app.logger.error('Error running spatial similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500
    return jsonify({"Succes":"Ran spatial similarity"}), 200

@app.route('/api/run_timeseries_similarity', methods=['POST'])
def run_timeseries_similarity():
    try:
        app.config['cydre_app'].run_timeseries_similarity()
    except Exception as e:
        app.logger.error('Error running timeseries similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500 
    return jsonify({"Succes":"Ran timeseries similarity"}), 200

@app.route('/api/select_scenarios', methods=['POST'])
def select_scenarios():
    try:
        app.config['cydre_app'].select_scenarios(spatial=True)
    except Exception as e:
        app.logger.error('Error selecting scenarios": %s', str(e))
        return jsonify({'error': str(e)}), 500
    return jsonify({"Succes":"Selected scenarios"}), 200



@app.route('/api/update_indicator', methods=['POST'])
def update_indicator():
    data = request.json
    m10_value = data.get('m10')
    try:
        with app.app_context():
            app.config['m10_indicator'] = m10_value
        return jsonify({'success':"M10 indicator updated with value "+str(m10_value)})
    
    except Exception as e:
        app.logger.error('Error updating indicator: %s', str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/simulateur/get_m10_values/<task_id>', methods=['GET'])
def get_m10_values(task_id):
    try:
        # Retrieve the stored Cydre app and Graph object
        cydre_app = app.config.get('cydre_app')
        graph_results = app.config.get('graph_results')

        if cydre_app is None:
            app.logger.error('Cydre app is not initialized')
            return jsonify({'error': 'Cydre app is not initialized'}), 500

        if graph_results is None:
            app.logger.error('Graph results are not initialized')
            return jsonify({'error': 'Graph results are not initialized'}), 500

        # Update the indicator and get new projections
        new_results = graph_results.new_projections(app.config.get('m10_indicator'))
        results_storage[task_id]['ndays_before_alert'] = new_results['ndays_before_alert']
        results_storage[task_id]['ndays_below_alert'] = new_results['ndays_below_alert']
        results_storage[task_id]['volume10'] = new_results['volume10']
        results_storage[task_id]['volume50'] = new_results['volume50']
        results_storage[task_id]['volume90'] = new_results['volume90']
        results_storage[task_id]['prop_alert_all_series'] = new_results['prop_alert_all_series']


        results_storage[task_id]['ndays_below_alert'] = new_results['ndays_below_alert']

        return jsonify(new_results), 200
    except Exception as e:
        app.logger.error('Error getting updated m10 values %s', str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/results/<task_id>', methods=['GET'])
def get_results(task_id):
    if task_id in results_storage:
        return jsonify(results_storage[task_id])
    else:
        return jsonify({'status': 'processing'})

@app.route('/api/simulateur/getCorrMatrix/<task_id>', methods=['GET'])
def getCorrMatrix(task_id):
    cydre_app = app.config['cydre_app']
    try:
        corr_matrix = pd.DataFrame(cydre_app.scenarios_grouped)
        df = corr_matrix.reset_index()
        df.columns = ['Year', 'ID', 'Coeff']
        df['Coeff'] = df['Coeff'].round(2)
        df['ID'] = df['ID'].map(gdf_stations.set_index('ID')['name'].to_dict())
        df = df.astype({'Year': 'int', 'Coeff': 'float'})
        corr_matrix = df.to_dict(orient='records')
        results_storage[task_id]['corr_matrix'] = corr_matrix
        return jsonify(corr_matrix),200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/simulateur/getGraph/<task_id>', methods=['GET'])
def getGraph(task_id):
    cydre_app = app.config['cydre_app']
    task= str(task_id)
    try:
        df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast()

        results = Graph(cydre_app, app.config['watershed_name'], stations, cydre_app.date,
                            log=True, module=True, baseflow=False, options='viz_plotly')
            
        app.logger.info('Cydre app and Graph results are initialized and stored')
        
        results_storage[task_id].update(results.plot_streamflow_projections(module=True))
        with app.app_context():
            app.config['m10_indicator'] = results.mod10
            app.config['graph_results'] = results
        return jsonify({'success':'Graph has been returned and stored'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

class Graph():
    def __init__(self,cydre_app,watershed_name, stations, selected_date,
                    log=True, module=True, baseflow=False, options='viz_plotly'):
        self.watershed_id = cydre_app.UserConfiguration.user_watershed_id
        self.streamflow_proj = cydre_app.df_streamflow_forecast
        self.watershed_name = watershed_name
        self.watershed_area = cydre_app.watersheds[self.watershed_id]['hydrometry']['area']
        self.streamflow = cydre_app.watersheds[self.watershed_id]['hydrometry']['specific_discharge']
        self.streamflow_proj_series = cydre_app.Forecast.Q_streamflow_forecast_normalized
        self.projection_period = cydre_app.Forecast.forecast_period
        self.station_forecast = cydre_app.df_station_forecast
        self.scenarios = cydre_app.scenarios_grouped
        self.simulation_date = cydre_app.date
        self.similarity_period = cydre_app.Similarity.user_similarity_period
        self.similar_watersheds = cydre_app.Similarity.similar_watersheds



    def _get_streamflow(self):
        
        # Observation
        reference_df = self.streamflow.copy()
        reference_df['daily'] = reference_df.index.strftime('%m-%d')
        reference_df['Q'] *= (self.watershed_area * 1e6) # m/s > m3/s
        
        # Projections
        projection_df = self.streamflow_proj.copy()
        projection_df = projection_df.set_index(self.projection_period)
        projection_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        # Individual projections
        projection_series = []
        
        for serie in self.streamflow_proj_series:
            serie = pd.DataFrame(serie)
            serie['Q_streamflow'] *= (self.watershed_area * 1e6)
            serie = serie.set_index(self.projection_period)
            projection_series.append(serie)
        
        return reference_df, projection_df, projection_series
    
    def new_projections(self, m10):
        reference_df, projection_df, projection_series = self._get_streamflow()
        # Update the module calculation
        self.mod10 = m10
        
        # Proportion of past events below the alert threshold
        n_events = len(projection_series)
        n_events_alert = 0
        
        for events in range(len(projection_series)):
            projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= self.mod10
            projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
            if projection_series[events]['alert'].any():
                n_events_alert += 1
            else:
                n_events_alert += 0
        
        self.prop_alert_all_series = n_events_alert / n_events

        # Initialize volumes
        self.volume10 = 0
        self.volume50 = 0
        self.volume90 = 0
        

        # Ensure proper calculation and error handling for each volume
        try:
            alert_df = projection_df[projection_df['Q10'] <= self.mod10]
            q_values = alert_df['Q10'] * 86400
            self.volume10 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume10 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q50'] <= self.mod10]
            q_values = alert_df['Q50'] * 86400
            self.volume50 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume50 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q90'] <= self.mod10]
            q_values = alert_df['Q90'] * 86400
            self.volume90 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume90 calculation: {e}")

        mod10_intersect = projection_df[['Q10', 'Q50', 'Q90']] <= self.mod10
        mod10_alert = mod10_intersect & mod10_intersect.shift(-1)

        try:
            mod10_first_occurence_Q10 = projection_df[mod10_alert['Q10']].iloc[0].name 
            self.ndays_before_alert_Q10 = (mod10_first_occurence_Q10 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q10 = None
            self.ndays_before_alert_Q10 = 0
        
        try:
            mod10_first_occurence_Q50 = projection_df[mod10_alert['Q50']].iloc[0].name 
            self.ndays_before_alert_Q50 = (mod10_first_occurence_Q50 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q50 = None
            self.ndays_before_alert_Q50 = 0
            
        try:
            mod10_first_occurence_Q90 = projection_df[mod10_alert['Q90']].iloc[0].name
            self.ndays_before_alert_Q90 = (mod10_first_occurence_Q90 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q90 = None
            self.ndays_before_alert_Q90 = 0
        # Number of cumulated days below the alert threshold
        self.ndays_below_alert = np.sum(mod10_intersect)

        results = {
            'volume50': float(self.volume50),
            'volume10': float(self.volume10),
            'volume90': float(self.volume90),
            'prop_alert_all_series': int(self.prop_alert_all_series),
            'ndays_before_alert':{
                'Q10': float(self.ndays_before_alert_Q10),
                'Q50': float(self.ndays_before_alert_Q50),
                'Q90': float(self.ndays_before_alert_Q90),
            },
            'ndays_below_alert': {
                'Q10': float(self.ndays_below_alert['Q10']),
                'Q50': float(self.ndays_below_alert['Q50']),
                'Q90': float(self.ndays_below_alert['Q90']),
            },
        }
        return results

    
    def plot_streamflow_projections(self, log=True, module=False, baseflow=False, options='viz_plotly'):
        
        # -------------- CYDRE RESULTS --------------

        # Extract observation and projection timeseries data
        reference_df, projection_df, projection_series = self._get_streamflow()
        
        # Adding stations projections
        self.station_forecast.index = projection_df.index
        projection_df['Q50_station'] = self.station_forecast['Q50']
        projection_df['Q50_station'] *= (self.watershed_area * 1e6)
        projection_df['Q10_station'] = self.station_forecast['Q10']
        projection_df['Q10_station'] *= (self.watershed_area * 1e6)
        projection_df['Q90_station'] = self.station_forecast['Q90']
        projection_df['Q90_station'] *= (self.watershed_area * 1e6)
        
        # -------------- OPERATIONAL INDICATORS --------------
        
        # Calculate the module (1/10 x mean streamflow)
        if module:
            self.mod, self.mod10 = self._module(reference_df)
        
        
        # Projected streamflow (last day value and evolution)
        self.proj_values = projection_df.iloc[-1]
        self.proj_values_ev = (self.proj_values - reference_df['Q'][-1])/reference_df['Q'][-1] * 100
        
        # Number of days before projected streamflow intersect the module
        mod10_intersect = projection_df[['Q10', 'Q50', 'Q90']] <= self.mod10
        mod10_alert = mod10_intersect & mod10_intersect.shift(-1)
        
        try:
            mod10_first_occurence_Q10 = projection_df[mod10_alert['Q10']].iloc[0].name 
            self.ndays_before_alert_Q10 = (mod10_first_occurence_Q10 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q10 = None
            self.ndays_before_alert_Q10 = 0
        
        try:
            mod10_first_occurence_Q50 = projection_df[mod10_alert['Q50']].iloc[0].name 
            self.ndays_before_alert_Q50 = (mod10_first_occurence_Q50 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q50 = None
            self.ndays_before_alert_Q50 = 0
            
        try:
            mod10_first_occurence_Q90 = projection_df[mod10_alert['Q90']].iloc[0].name
            self.ndays_before_alert_Q90 = (mod10_first_occurence_Q90 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q90 = None
            self.ndays_before_alert_Q90 = 0
        
        # Number of cumulated days below the alert threshold
        self.ndays_below_alert = np.sum(mod10_intersect)
        
        # Proportion of past events below the alert threshold
        n_events = len(projection_series)
        n_events_alert = 0
        
        for events in range(len(projection_series)):
            projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= self.mod10
            projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
            if projection_series[events]['alert'].any():
                n_events_alert += 1
            else:
                n_events_alert += 0
        
        self.prop_alert_all_series = n_events_alert / n_events
        
        # Volume to supply low flows
        alert_df = projection_df[mod10_alert['Q10']]
        q_values = alert_df['Q10'] * 86400
        self.volume10 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q50']]
        q_values = alert_df['Q50'] * 86400
        self.volume50 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q90']]
        q_values = alert_df['Q90'] * 86400
        self.volume90 = ((self.mod10*86400) - q_values).sum()
        
        

        # Calculate baseflow
        if baseflow:
            self.Q_baseflow = self.baseflow()
            reference_df['baseflow'] = self.Q_baseflow * self.watershed_area * 1e6
            
        # Merge observation and projection timeseries data
        merged_df = pd.merge(reference_df, projection_df, left_on=reference_df.index,
                             right_on=projection_df.index, how='right')
        merged_df = merged_df.set_index(merged_df['key_0'])

        # Convert Plotly objects to JSON serializable format
        graph_data = {
        'data': [
            go.Scatter(x=merged_df.index.tolist(), y=merged_df['Q90'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q90").to_plotly_json(),
            go.Scatter(x=merged_df.index.tolist(), y=merged_df['Q50'].tolist(), mode='lines', line=dict(color='blue', width=1.5, dash='dot'), name='Q50').to_plotly_json(),
            go.Scatter(x=merged_df.index.tolist(), y=merged_df['Q10'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q10").to_plotly_json(),
            go.Scatter(x=reference_df.index.tolist(), y=reference_df['Q'].tolist(), mode='lines', line=dict(color='black', width=1.5), name="observations").to_plotly_json()
        ],
        'layout': go.Layout(
            title=f"{self.watershed_name} - {len(self.scenarios)} événements",
            xaxis={'title': 'Date', 'type': 'date'},
            yaxis={'title': 'Débit (m3/s)', 'type': 'log' if log else 'linear'},
            margin={'l': 40, 'r': 40, 't': 80, 'b': 40},
            plot_bgcolor='white'
        ).to_plotly_json()
        }

        # Convert each projection series DataFrame to a Plotly trace
        for idx, serie in enumerate(projection_series):
            serie_trace = go.Scatter(
                x=serie.index.tolist(),
                y=serie['Q_streamflow'].tolist(),
                mode='lines',
                line=dict(color='rgba(0, 0, 255, 0.2)', width=1),  # Semi-transparent blue lines
                name=f'Projection {idx + 1}'
            ).to_plotly_json()
            graph_data['data'].append(serie_trace)

        data = {
        'graph': graph_data,
        'proj_values': {
            'Q50': float(self.proj_values.Q50),
            'Q10': float(self.proj_values.Q10),
            'Q90': float(self.proj_values.Q90)
        },
        'ndays_before_alert':{
            'Q50': float(self.ndays_before_alert_Q50),
            'Q90': float(self.ndays_before_alert_Q90),
            'Q10': float(self.ndays_before_alert_Q10)
        },
        'ndays_below_alert': {
            'Q50': float(self.ndays_below_alert['Q50']),
            'Q90': float(self.ndays_below_alert['Q90']),
            'Q10': float(self.ndays_below_alert['Q10'])
        },
        'prop_alert_all_series': int(self.prop_alert_all_series),
        'volume50': float(self.volume50),
        'volume10': float(self.volume10),
        'volume90': float(self.volume90),
        'last_date': self.projection_period[-1].strftime("%d/%m/%Y"),
        'first_date': self.simulation_date.strftime('%Y-%m-%d'),
        'similarity_period' : self.similarity_period.strftime('%Y-%m-%d').tolist(),
        'm10' : float(self.mod10),
        'similar_watersheds' : self.similar_watersheds
        }

        return data

    def _module(self, reference_df):
        reference_df['year'] = reference_df.index.year
        df = reference_df.groupby('year')['Q'].mean()
        mod = df.mean()
        mod10 = mod/10
        return mod, mod10
    

if __name__ == '__main__':
    app.run(host='localhost')

