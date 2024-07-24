# -*- coding: utf-8 -*-
"""
Created on Thu Jun  1 16:06:06 2023

@author: Nicolas Cornette

Launchers for watershed delineation and updating watersheds.shp.
You need to complete stations.csv before the use of this script.
"""

import sys
# Python modules
import os
import time
import pyproj
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from shapely.geometry import MultiPolygon, Polygon

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.preprocessing.watershed_root as WS


start = time.time()


#%% PREPARATION

# Watershed to add
station_ID = "J8002310"

# Define paths
data_path = os.path.join(app_root, 'data')
dem_path = os.path.join(data_path, 'dem', 'MNT.tif')
geo_path = os.path.join(data_path, 'geographic')

# Load hydrological stations
stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

# Load watersheds boundaries
gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')


#%% Watershed delineation

# Get station info
station_info = stations[stations["ID"] == station_ID]
print(stations[stations['ID'] == station_ID].station_name.values[0])

# Create the watershed
BV = WS.Watershed(watershed_id=station_ID,
                  dem_path=dem_path,
                  out_path=geo_path,
                  stations_file=stations,
                  save_object=False,
                  load_object=False)

# Multipolygon to Polygon
new_geometry = BV.geographic.geometry

if isinstance(new_geometry, MultiPolygon):
    multi_polygon = new_geometry.iloc[0]
    polygons = list(multi_polygon.geoms)
    polygon = polygons[0]
    new_geometry = gpd.GeoDataFrame({'geometry': [polygon]}, crs=new_geometry.crs)
    new_geometry = new_geometry['geometry']

# Lambert 93 to WGS84
new_geometry.crs = 'EPSG:2154'    
new_geometry = new_geometry.to_crs(epsg=4326)
    
# Prepare the geodataframe concatenation
new_data = {
    'name': station_info.station_name.values[0],
    'geometry_a': BV.geographic.area,
    'hydro_area': station_info.area.values[0],
    'K1': None,
    'geometry': new_geometry.values[0],
}

new_gdf = gpd.GeoDataFrame([new_data], columns=['name', 'geometry_a', 'hydro_area', 'K1', 'geometry'])
new_gdf.index = [station_ID]

# Update watersheds.shp and export
gdf_watersheds = pd.concat([gdf_watersheds, new_gdf], ignore_index=False)
gdf_watersheds = gdf_watersheds.sort_index()
gdf_watersheds.to_file(os.path.join(data_path, 'watersheds.shp'), driver='ESRI Shapefile')
