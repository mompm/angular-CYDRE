# -*- coding: utf-8 -*-
"""
Created on Thu Apr 20 15:03:30 2023

@author: Nicolas Cornette
"""

# Modules
import os
import glob
import numpy as np
import pandas as pd
import geopandas as gpd
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib_scalebar.scalebar import ScaleBar
import random

#NICOLAS: est-ce encore utilisé ou utilisable? Est-ce que cela vaut le coup de le garder et de le maintenir? 


class Geology():
    """
    class Geology used to group lithological formations and simplify the geological map.

    Parameters:
    ----------
    geology_folder : str
        folder where the geological map is stored.
    
    Attributes:
    ----------
    geology_folder : str
        folder where the geological map is stored.
    geology_map : DataFrame
        raw regional geological map.
    color_dict : dict
        dictionnary to relate each geological formation to a random color.
    
    Methods:
    ----------
    load_geology_map(geology_folder)
        Load the geological map stored in a specific folder.
    plot_geology_map()
        Display the geological map.
    update_geology(correspondence_table)
        Update the geological map by grouping the geological formations.
        This method uses a correspondence table.
    """

    def __init__(self, path):
        
        # Geological map path
        filename = os.path.join(path, 'GEOL_001M_MassifArm.shp')
        self.geology_map_file = filename        
        
        # Load the geological map
        self.geology_map, self.color_dict = self.load_geology_map(self.geology_map_file)
        
        # Store lithological composition
        #self.get_data(bh_id, path)
        
        
    def get_data(self, bh_id, path):
        
        file = os.path.join(path, 'lithology.csv')
        data = pd.read_csv(file, sep=';', decimal=',')
        
        self.lithology = data[data['ID'] == bh_id]
        
        
    def load_geology_map(self, filename):
        """
        Load the geological map stored in a specific folder.

        Parameters
        ----------
        filename : str
            folder where the geological map is stored.

        Returns
        -------
        geology_map : DataFrame
            raw regional geological map.
        color_dict : dict
            dictionnary to relate each geological formation to a random color.

        """
        # Load the geological map (scale: 1/1 000 000°, source: BRGM)
        geology_map = gpd.read_file(filename)
        
        # Set an inital topology: e.g., column CODE_LEG_S describe 168 
        # lithological formations for the Massif Armoricain area.
        geology_map['Typo'] = geology_map['CODE_LEG_S']
        
        # Generate random color to plot the geological map
        no_of_colors = len(np.unique(geology_map['Typo']))
        color_list =["#"+''.join([random.choice('0123456789ABCDEF') for i in range(6)])
               for j in range(no_of_colors)]
        typo_list = list(np.unique(geology_map['Typo']))
        
        # Set the dictionnary to relate each formation to a color
        color_dict = dict(zip(typo_list, color_list))
        
        # Get the color for each shapefile
        geology_map['color'] = geology_map['Typo'].map(color_dict)
        
        return geology_map, color_dict
    
    
    def plot_geology_map(self):
        """
        Display the geological map.
        !!NOTE perso: Pour l'instant le code nécessite deux éléments:
            - une colonne Typo qui correspond à la nouvelle typologie
            - une colonne color_dict qui affecte pour chaque typologie une couleur
        !!
        
        Returns
        -------
        None.

        """        
        # Initialization
        mpl.rcParams.update(mpl.rcParamsDefault)
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        
        # Figure size
        fig, ax = plt.subplots(1, 1, figsize=(10, 10))
        
        # Plot the geological map 
        ax = self.geology_map.plot(ax=ax, color=self.geology_map['color'], edgecolor='k', linewidth=0.2, alpha=1)
        
        # Add a scale bar
        ax.add_artist(ScaleBar(1,location='lower left', 
                               font_properties={'family':'serif', 'size': 'x-large'}))
        
        # Set the axis
        plt.yticks(fontsize=9)
        plt.xticks(fontsize=9)
        ax.set_ylabel('Y [m]', fontsize=16)
        ax.set_xlabel('X [m]', fontsize=16)
        #ax.set_xlim(minx-10000, maxx+10000)
        #ax.set_ylim(miny-20000, maxy+20000) #50000 plus large
        ax.get_yaxis().get_major_formatter().set_scientific(False)
        ax.grid(True, which='both', zorder=-1, linestyle='-', alpha=0.4)
        ax.tick_params(axis="both", which='both', direction = "inout")
        ax.axis(False)
        
        # Show the geological map in the plot panel
        plt.show()
        
        
    def update_geology(self, correspondence_table, color_dict):
        """
        Update the geological map by grouping the geological formations.
        This method uses a correspondence table stored in geology_folder.
        
        Parameters
        ----------
        correspondence_table : DataFrame
            correspondence_table between old lithological codes and new typology.
        
        Returns
        -------
        geology_map : DataFrame
            raw regional geological map.
        color_dict : dict
            dictionnary to relate each geological formation to colors.
        """
        old_geology_map = self.geology_map
        
        # Update column 'Typo' on geology_map
        correspondence_table = dict(zip(correspondence_table.CODE_LEG_S, 
                                        correspondence_table.NEW_CODE))
        new_geology_map = old_geology_map
        new_geology_map['Typo'] = new_geology_map['Typo'].map(correspondence_table)
        
        # Update column 'Color' on geology_map
        new_color_dict = dict(zip(color_dict.ID, color_dict.COLOR))
        new_legend_dict = dict(zip(color_dict.ID, color_dict.LABEL))
        new_geology_map['color'] = new_geology_map['Typo'].map(new_color_dict)
        new_geology_map['LABEL'] = new_geology_map['Typo'].map(new_legend_dict)

        # Save new_geology_map
        self.geology_map = new_geology_map
        
        # tmp : update doesn't work for 3 rows (on the 3029 row of the df)
        # until we resolve this issue, we remove these 3 rows
        self.geology_map = self.geology_map.dropna(subset=['color'])
        
        # Plot the new geology_map
        self.plot_geology_map()
        
    
    def geological_composition(self, geology_map, watershed):
        
        # Clip the geological map with the watershed boundaries
        tmp_file = gpd.clip(geology_map, watershed)
        tmp_file = gpd.GeoDataFrame(tmp_file)
        
        # Calculation of the area of each geological formation
        geology_area = tmp_file.area
        watershed_area = np.sum(geology_area)
        watershed_geological_composition = geology_area / watershed_area

        # Save data in a dataframe
        df_geological_composition = pd.DataFrame({
            "Lithology":tmp_file.Typo,
            "Area":tmp_file.area,
            "Composition":watershed_geological_composition})
        
        return df_geological_composition


    def group_geological_composition(self, out_folder):
        
        # Unique geological formations
        geological_formations = np.unique(self.geology_map['Typo'])
        
        # All .csv watershed geological composition files
        csv_files = glob.glob(os.path.join(out_folder, "*_l.csv"))
        
        # DataFrame Initialization
        df_geology = pd.DataFrame(columns=geological_formations)
        
        # Loop on each file
        for file in csv_files:
            
            # Get the watershed id
            filename = os.path.basename(file)
            name_without_extension = os.path.splitext(filename)[0]
            bh_id = name_without_extension.split('_')[0]
            
            # Read the .csv file
            df = pd.read_csv(file)
            list_to_fill = []
            
            # Loop on each geological formation
            for geol in geological_formations:
                
                try:
                    value = np.sum(df[df['Lithology'] == geol].Composition.values)
                except:
                    value = 0
                
                list_to_fill.append(value)
            
            # Fill the dataframe
            df_geology.loc[bh_id] = list_to_fill
            
        return df_geology
