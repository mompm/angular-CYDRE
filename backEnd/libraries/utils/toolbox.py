# -*- coding: utf-8 -*-

"""
Toolbox used for repetitive functions.
"""

import os
import pickle
import pyproj
import csv
from flask import jsonify
import json
from collections import OrderedDict


def create_folder(path):
    if not os.path.exists(path):
        os.makedirs(path)
        
def save_object(obj, out_path, name):
    with open(os.path.join(out_path,name), 'wb+') as f:
        pickle.dump(obj, f, pickle.HIGHEST_PROTOCOL)

def load_object(out_path, name):
    with open(os.path.join(out_path,name), 'rb') as f:
        return pickle.load(f)
    
def lambert93_to_wgs84(x, y):
    """
    Transforme les coordonnées de Lambert-93 (EPSG:2154) vers WGS84 (EPSG:4326).

    Args:
    - x (pandas.Series ou list): Coordonnées X en Lambert-93.
    - y (pandas.Series ou list): Coordonnées Y en Lambert-93.

    Returns:
    - tuple: Coordonnées transformées en WGS84 (x_wgs84, y_wgs84).
    """
    lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
    x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(x, y)
    return x_wgs84, y_wgs84


def get_station_name_by_id(gdf_stations, id_upper):
    return gdf_stations[gdf_stations['ID'] == id_upper]['station_name'].values[0]
    

def read_csv_and_generate_response(csv_file_path, id_upper, gdf_stations, keys):
    if os.path.exists(csv_file_path):
        station_name = get_station_name_by_id(gdf_stations, id_upper)
        json_list = [station_name, id_upper]
        with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for row in csv_reader:
                json_object = {key: row[key] for key in keys}
                json_list.append(json_object)
        return jsonify(json_list), 200
    else:
        return jsonify({"filename": os.path.basename(csv_file_path)}), 404
    

# Fonction qui extrait récursivement les noms des paramètres d'un json
def extract_param_names(params, prefix=""):
    param_names = []
    for key, value in params.items():
        current_path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            param_names.extend(extract_param_names(value, current_path))
        else:
            param_names.append(current_path)
    return param_names

# Classe permettant de ne pas organiser les paramètres dans l'ordre alphabétique mais dans l'ordre du fichier xml
class OrderedDictEncoder(json.JSONEncoder):
    def encode(self, obj):
        if isinstance(obj, OrderedDict):
            return json.dumps(obj, default=self.default, sort_keys=False, indent=4)
        return super().encode(obj)