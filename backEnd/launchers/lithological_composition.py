# -*- coding: utf-8 -*-
"""
Created on Mon Jul 15 16:56:34 2024

@author: Nicolas Cornette

Determines the lithological composition of the watershed defined and given by a shapefile 

"""

import sys
# Python modules
import os
import pandas as pd
import geopandas as gpd


# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

import libraries.preprocessing.data.geology as GEOL

# MODE is either
#       'regional'      : watersheds defined at a regional scale 
#       'stations_hydro': only hydrological stations 
MODE = 'regional'

data_path = os.path.join(app_root, 'data')
geol_path = os.path.join(data_path, 'geology')

# Correspondance table between lithologies to group them geo-logically
correspondence_table = pd.read_csv(os.path.join(geol_path, 'correspondence_table.csv'), sep=';')
# Dictionary of colors for each of the lithology (once they are grouped)
color_dict = pd.read_csv(os.path.join(geol_path, 'color_dict.csv'), sep=';')

# Loads geological map and simplification according to the correspondance table defined before
Geology = GEOL.Geology(geol_path)
Geology.update_geology(correspondence_table, color_dict)

if MODE == 'stations_hydro':
    # Load watersheds boundaries
    gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds2.shp'))
    gdf_watersheds = gdf_watersheds.set_index('index')
    
elif MODE == 'regional':
    gdf_watersheds = gpd.read_file(os.path.join(data_path, 'BV_Bretagne.shp'))
    gdf_watersheds = gdf_watersheds.set_index('ZONEHYDRO')

lithology = {}

# Loop over watersheds 
for idx in gdf_watersheds.index:
    # Extract identifier from dataframe and, after, gets its geometry 
    watershed = gdf_watersheds[gdf_watersheds.index == idx]['geometry']
   
    if MODE == 'stations_hydro':
        # conversion for the station_hydro to Lambert93 (not necessary for watersheds)
        watershed = watershed.to_crs(epsg=2154)
    
    geol_composition = Geology.geological_composition(Geology.geology_map, watershed)
    geol_composition = geol_composition.groupby('Lithology').sum()
    lithology[idx] = geol_composition

# Initialisation d'un DataFrame vide pour stocker les résultats.
result_df = pd.DataFrame()

for idx, df in lithology.items():
    df = df[['Composition']]  # Sélectionnez uniquement la colonne de Composition
    df = df.transpose()  # Transposez pour avoir les lithologies comme colonnes
    df.index = [idx]  # Ajoutez l'idx comme nouvel index
    result_df = pd.concat([result_df, df], axis=0)

# Remplir les valeurs NaN avec 0 si certaines lithologies ne sont pas présentes dans tous les idx.
result_df = result_df.fillna(0)
result_df.to_csv(os.path.join(geol_path, "composition_lithologique.csv"))
