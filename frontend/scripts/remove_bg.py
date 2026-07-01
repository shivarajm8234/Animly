import os
from PIL import Image
import glob

def remove_background(image_path, output_path):
    print(f"Processing: {image_path} -> {output_path}")
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()
    
    # We will make pixels transparent if they are very close to white.
    # To avoid jagged edges, we can do a simple tolerance check.
    newData = []
    for item in datas:
        # Check if r, g, b are all high
        if item[0] > 245 and item[1] > 245 and item[2] > 245:
            newData.append((255, 255, 255, 0)) # transparent
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    brain_dir = "/home/satoru/.gemini/antigravity/brain/aa8453d6-3b50-470d-8669-ab30f2e669a2/"
    output_dir = "/home/satoru/Desktop/Projects/Animly/frontend/public/images/"
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Map prefix to character name
    prefix_map = {
        "newton": "mr_newton",
        "curie": "ms_curie",
        "ada": "ada",
        "leo": "leo"
    }
    
    poses = ["idle", "thinking", "talking", "teaching"]
    
    for prefix, char_name in prefix_map.items():
        for pose in poses:
            # Find the file that starts with {prefix}_{pose}_
            pattern = os.path.join(brain_dir, f"{prefix}_{pose}_*.png")
            files = glob.glob(pattern)
            
            if files:
                # take the most recently generated one if multiple
                files.sort(key=os.path.getmtime, reverse=True)
                source_file = files[0]
                dest_file = os.path.join(output_dir, f"{char_name}_{pose}.png")
                remove_background(source_file, dest_file)
            else:
                print(f"Warning: No file found for {prefix}_{pose}")

print("Background removal and export complete!")
