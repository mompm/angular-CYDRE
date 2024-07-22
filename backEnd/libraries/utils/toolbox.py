# -*- coding: utf-8 -*-

"""
Toolbox used for repetitive functions.
"""

import os
import pickle
import pyproj


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