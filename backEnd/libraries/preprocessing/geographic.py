# -*- coding: utf-8 -*-
"""
Created on Mon Apr 24 10:52:14 2023

@author: Nicolas Cornette
"""

# Modules
import whitebox
wbt = whitebox.WhiteboxTools()
wbt.verbose = False
import os
import numpy as np
import pandas as pd
import geopandas as gpd
from osgeo import gdal, osr
import matplotlib.pyplot as plt
import rasterio


class Geographic():
    """
    class Geographic used to delineate the watershed from outlet coordinates.

    Parameters:
    ----------
    
    Attributes:
    ----------  
    
    Methods:
    ----------

    """
    
    def __init__(self, dem_path, x_outlet, y_outlet, snap_dist, regional_out_path,
                 watershed_out_path, buff_percent=1000):
        
        # Regional data
        dem_path = dem_path
        self.regional_out_path = regional_out_path
        
        # Watershed outlet
        self.x_outlet = x_outlet
        self.y_outlet = y_outlet
        self.snap_dist = snap_dist
        self.buff_percent = buff_percent
        
        # Watershed delineation
        self.watershed_out_path = watershed_out_path
        self.watershed_delineation(dem_path,
                                   self.x_outlet,
                                   self.y_outlet,
                                   self.snap_dist)
        
        
    def watershed_delineation(self, dem_path, x_outlet, y_outlet, snap_dist):
        
        """
        Watershed delineation from digital elevation model map and outlets coordinates.

        Parameters
        ----------
       
        Returns
        -------
       
        """
        
        # Fill depressions in the DEM (Correction)
        fill =  os.path.join(self.regional_out_path, 'fill.tif')
        if not os.path.exists(fill):
            wbt.fill_depressions(dem_path, fill)
            
        #print('fill: OK')
            
        # Flow direction
        direc =  os.path.join(self.regional_out_path, 'flow_dir.tif')
        if not os.path.exists(direc):
            wbt.d8_pointer(fill, direc, esri_pntr=False)
        
        #print('direc: OK')    
        
        # Flow accumulation
        acc =  os.path.join(self.regional_out_path, 'flow_acc.tif')
        if not os.path.exists(acc):
            wbt.d8_flow_accumulation(fill, acc, log=True)
        
        #print('acc: OK')
        
        # Correct no data
        wbt.modify_no_data_value(dem_path, new_value='-99999.0')
        
        # Open correct DEM
        dem = gdal.Open(dem_path)
        geodata = dem.GetGeoTransform()
        
        # Extract the coordinate system
        proj = osr.SpatialReference(wkt=dem.GetProjection())
        self.crs = 'EPSG:'+str(proj.GetAttrValue('AUTHORITY',1))
        
        # Create outlet shapefile from x and y coordinates
        df = pd.DataFrame({'x': [x_outlet], 'y': [y_outlet]})
        self.gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df['x'], df['y']), 
                               crs=self.crs)
        self.outlet_shp = os.path.join(self.watershed_out_path, 'outlet.shp')
        self.gdf.to_file(self.outlet_shp)
        
        # Snap the outlet shapefile from the flow accumulation
        outlet_snap_shp = os.path.join(self.watershed_out_path, 'outlet_snap.shp')
        wbt.snap_pour_points(self.outlet_shp, acc, outlet_snap_shp, snap_dist)
        
        # Generate raster watershed
        watershed = os.path.join(self.watershed_out_path, 'watershed.tif')
        wbt.watershed(direc, outlet_snap_shp, watershed, esri_pntr=False)
        
        #print('watershed raster: OK')
        
        # Create shapefile polygon of the watershed
        self.watershed_shp = os.path.join(self.watershed_out_path, 'watershed.shp')
        wbt.raster_to_vector_polygons(watershed, self.watershed_shp)
        
        # Remove watershed (.tiff) (to remove a lot of Go)
        os.remove(watershed)
        
        self.geometry = gpd.read_file(self.watershed_shp)['geometry']
        
        #print('watershed shapefile: OK')
        
        # Compute watershed area
        wbt.polygon_area(self.watershed_shp)
        area = gpd.read_file(self.watershed_shp).AREA[0]/1000000
        self.area = np.abs(area)
        
        """
        Buffer distance operations
        """
        # Normalize initial buffer distance value
        buff_raw = (np.sqrt(float(self.area))) * (float(self.buff_percent)/100) * 1000
        buff_raw = int(round(buff_raw))
        dist = np.linspace(0,buff_raw,buff_raw+1)*np.abs(geodata[1])
        buff_dist = dist[np.abs(dist-buff_raw).argmin()]
        # buff_dist = buff_raw
        # Buffer the watershed shapefile polygon
        site_polyg = gpd.read_file(self.watershed_shp)
        site_polyg.to_file(self.watershed_shp)
        site_polyg['geometry'] = site_polyg.geometry.buffer(buff_dist)
        buffer = os.path.join(self.watershed_out_path, 'buff.shp')
        site_polyg.to_file(buffer)
        
        """
        Box extent operations
        """
        # Create box extent of the watershed
        self.watershed_box_shp = os.path.join(self.watershed_out_path, 'watershed_box.shp')
        wbt.minimum_bounding_envelope(self.watershed_shp, self.watershed_box_shp, features=False)
        # Buffer the box extent watershed shapefile polygon
        site_bound = gpd.read_file(self.watershed_box_shp)
        site_bound.to_file(self.watershed_box_shp)
        site_bound['geometry'] = site_bound.geometry.buffer(buff_dist)
        box_buffer = os.path.join(self.watershed_out_path, 'box_buff.shp')
        site_bound.to_file(box_buffer)
        wbt.minimum_bounding_envelope(box_buffer, box_buffer, features=False)
        site_bound = gpd.read_file(box_buffer)
        site_bound.to_file(box_buffer)
        
        """
        Clip to reach buffer size
        """
        # Clip raw regional DEM from buffer watershed shapefile polygon
        self.watershed_buff_dem = os.path.join(self.watershed_out_path, 'watershed_buff_dem.tif')
        wbt.clip_raster_to_polygon(dem_path, buffer, self.watershed_buff_dem,
                                   maintain_dimensions=False)
    
    
    def plot_watershed(self, watershed_shp, dem_path):
        # Font properties (from toolbox class)
        # Args : font size, small, intermediate, medium and large
        #fontprop = toolbox.plot_params(8,15,18,20)
        
        # Plot watershed 
        fig, ax = plt.subplots(figsize=(8,6))
        #fig.patch.set_alpha(0)
        
        # Raster digital elevation model
        dem = rasterio.open(self.fill)
        rasterio.plot.show(dem.read(1), cmap='terrain')
        
        # Shapefiles
        # -- outlet point
        outlet = gpd.read_file(self.outlet_shp)
        outlet.plot(ax=ax, markersize=180, facecolor="r", edgecolor="r")

        
        #contour = gpd.read_file(BV.geographic.watershed_contour_shp)
        #shp = gpd.read_file(watershed_shp)
       
        #ax=plt.imshow(dem.read(1), cmap='terrain', zorder=1)
        #plt.colorbar(label='Elevation (m)')
        #plt.grid(zorder=0)
        #ax.get_xaxis().set_visible(False)
        #ax.get_yaxis().set_visible(False)  
        #ax.set(aspect='equal')
        #show(np.ma.masked_where(dem.read(1) < 0, dem.read(1)), ax=ax, transform=dem.transform, 
         #    cmap='terrain', alpha=1, zorder=2, aspect="auto")
        #shp.plot(ax=ax, lw=2, color='yellow', zorder=4,legend=True, label='Watershed')
        #contour.plot(ax=ax, lw=2, color='k', zorder=4,legend=True, label='Watershed')
        #fig.tight_layout()
      