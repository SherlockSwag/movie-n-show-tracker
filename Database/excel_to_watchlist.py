import pandas as pd
import requests
import json
import time
import re
import csv
import difflib
from datetime import datetime
from urllib.parse import quote_plus

# =============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# =============================================================================

TMDB_API_KEY = '06251a03ea2bdbb4cf38b681d8263a92'  # Your TMDB API Key
EXCEL_FILE_PATH = 'my_watchlist_data.xlsx'         # Path to your Excel file

# Column names in your Excel sheet (UPDATE THESE TO MATCH YOUR SHEET)
COLUMN_TITLE = 'Title'              # Column with movie/show titles
COLUMN_MEDIA_TYPE = 'Movie/Show'    # Column indicating "Movie" or "Show" 
COLUMN_STATUS = 'Status'            # Column with "Watched", "Unwatched", etc.

# Output files
WATCHLIST_JSON_FILE = 'watchlist_export.json'  # For auto-import to your web app
MANUAL_REVIEW_CSV = 'manual_review.csv'        # Titles needing manual review

# TMDB API Settings
REQUEST_DELAY = 0.3  # Seconds between API calls (be nice to TMDB servers)

# Auto-selection rules
POPULARITY_THRESHOLD = 3.0          # How much more popular the top result needs to be
MIN_POPULARITY_FOR_AUTO_SELECT = 15.0  # Minimum popularity to auto-select
HIGH_POPULARITY_THRESHOLD = 50.0    # Very popular films auto-select

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def extract_year_from_title(title):
    """Extracts year from title if it exists. Example: 'Movie (2023)' -> 2023"""
    if not isinstance(title, str):
        title = str(title) if title is not None else ""
    
    year_pattern = r'\((\d{4})\)'
    match = re.search(year_pattern, title)
    
    if match:
        return int(match.group(1)), re.sub(year_pattern, '', title).strip()
    return None, title.strip()

def normalize_media_type(media_type):
    """Convert various spellings to standard 'movie' or 'tv'"""
    if not media_type or pd.isna(media_type):
        return None
    
    media_type = str(media_type).lower().strip()
    if 'movie' in media_type:
        return 'movie'
    elif 'show' in media_type or 'tv' in media_type or 'series' in media_type:
        return 'tv'
    return None

def normalize_status(status):
    """Determine if item goes to watchlist or watchedlist"""
    if not status or pd.isna(status):
        return 'watchlist'  # Default to watchlist if status is empty
    
    status = str(status).lower().strip()
    if 'watch' in status:  # 'watched', 'watch later', etc.
        return 'watchedlist' if status.startswith('watch') and 'ed' in status else 'watchlist'
    return 'watchlist'  # Default to watchlist

def search_tmdb(title, api_key, media_type=None, year_hint=None):
    """Search TMDB for a title and return results"""
    # If no media type specified, search both
    search_types = []
    if media_type:
        search_types = [media_type]
    else:
        search_types = ['movie', 'tv']
    
    all_results = []
    
    for search_type in search_types:
        url = f'https://api.themoviedb.org/3/search/{search_type}'
        params = {
            'api_key': api_key,
            'query': title,
            'page': 1,
            'year': year_hint if year_hint and search_type == 'movie' else None,
            'first_air_date_year': year_hint if year_hint and search_type == 'tv' else None,
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                for result in data.get('results', []):
                    result_data = {
                        'id': result['id'],
                        'title': result.get('title') or result.get('name'),
                        'media_type': search_type,
                        'release_date': result.get('release_date') or result.get('first_air_date'),
                        'original_language': result.get('original_language', ''),
                        'overview': result.get('overview', ''),
                        'popularity': result.get('popularity', 0),
                        'year': int(result.get('release_date', '')[:4]) if result.get('release_date') else None
                    }
                    all_results.append(result_data)
        except requests.exceptions.RequestException as e:
            print(f"    API Error for {search_type}: {e}")
    
    # Sort by popularity (highest first)
    return sorted(all_results, key=lambda x: x.get('popularity', 0), reverse=True)

def should_auto_select(candidates, clean_title, expected_year, expected_media_type):
    """Determine if we can automatically select the best candidate"""
    if not candidates:
        return False, None, "NOT_FOUND"
    
    # Rule 1: Only one candidate = auto-select
    if len(candidates) == 1:
        return True, candidates[0], "SINGLE_MATCH"
    
    # Calculate title similarity for all candidates
    scored_candidates = []
    for candidate in candidates:
        candidate_title = candidate['title'] or ''
        
        similarity = difflib.SequenceMatcher(
            None, clean_title.lower(), candidate_title.lower()
        ).ratio()
        
        year_bonus = 0.2 if expected_year and candidate.get('year') == expected_year else 0
        media_bonus = 0.1 if expected_media_type and candidate['media_type'] == expected_media_type else 0
        
        total_score = similarity + year_bonus + media_bonus
        scored_candidates.append((total_score, candidate))
    
    # Sort by total score (highest first)
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    best_score, best_candidate = scored_candidates[0]
    
    # NEW: Check for perfect score ties
    if len(scored_candidates) > 1:
        second_score, second_candidate = scored_candidates[1]
        if abs(best_score - second_score) < 0.001:  # Perfect tie
            return False, best_candidate, "PERFECT_TIE"
    
    # Existing auto-selection rules
    if best_score >= 0.95:
        return True, best_candidate, "EXCELLENT_MATCH"
    if best_score >= 0.90:
        return True, best_candidate, "VERY_GOOD_MATCH"
    if best_score >= 0.85 and len(candidates) <= 3:
        return True, best_candidate, "GOOD_MATCH_FEW_ALTERNATIVES"
    if len(scored_candidates) > 1:
        second_score, _ = scored_candidates[1]
        if best_score - second_score >= 0.15:
            return True, best_candidate, "CLEAR_SIMILARITY_WINNER"
    if best_candidate.get('popularity', 0) > HIGH_POPULARITY_THRESHOLD and best_score >= 0.7:
        return True, best_candidate, "HIGH_POPULARITY_DECENT_MATCH"
    if len(candidates) > 1:
        best_pop = best_candidate.get('popularity', 0)
        second_pop = candidates[1].get('popularity', 0)
        if best_pop - second_pop > POPULARITY_THRESHOLD and best_pop > MIN_POPULARITY_FOR_AUTO_SELECT:
            return True, best_candidate, "SIGNIFICANT_POPULARITY_DIFFERENCE"
    
    return False, best_candidate, "AMBIGUOUS"

def debug_similarity_scores(candidates, clean_title):
    """Print similarity scores for debugging"""
    print(f"  Similarity analysis for: '{clean_title}'")
    for i, candidate in enumerate(candidates[:3]):  # Show top 3
        similarity = difflib.SequenceMatcher(
            None, clean_title.lower(), (candidate['title'] or '').lower()
        ).ratio()
        print(f"    {i+1}. '{candidate['title']}' - Score: {similarity:.3f}")

def create_tmdb_url(title, media_type, year=None):
    """Create a TMDB search URL for manual verification"""
    base_url = "https://www.themoviedb.org/search"
    query = quote_plus(title)
    url = f"{base_url}/{media_type}?query={query}"
    if year:
        url += f"&year={year}"
    return url

# =============================================================================
# MAIN PROCESSING FUNCTION
# =============================================================================

def main():
    print("🎬 Movie/Show Watchlist Generator")
    print("=" * 50)
    
    # Read Excel file
    try:
        print(f"📖 Reading Excel file: {EXCEL_FILE_PATH}")
        df = pd.read_excel(EXCEL_FILE_PATH, sheet_name=0, keep_default_na=False)
        print(f"📊 Found {len(df)} entries to process")
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        return
    
    # Initialize results
    watchlist_items = []
    watchedlist_items = []
    manual_review_items = []
    
    # Create output files
    with open(MANUAL_REVIEW_CSV, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=[
            'original_title', 'clean_title', 'year_hint', 'media_type_hint', 
            'status', 'result_type', 'candidate_count', 'candidates_json', 'suggested_url'
        ])
        writer.writeheader()
    
    print("\n🔍 Processing titles...")
    print("-" * 50)
    
    # Process each row
    for index, row in df.iterrows():
        original_title = row[COLUMN_TITLE]
        media_type_hint = row.get(COLUMN_MEDIA_TYPE, '')
        status = row.get(COLUMN_STATUS, '')
        
        # Skip empty titles
        if not original_title or pd.isna(original_title):
            continue
        
        # Extract year and clean title
        year_hint, clean_title = extract_year_from_title(original_title)
        normalized_media_type = normalize_media_type(media_type_hint)
        normalized_status = normalize_status(status)
        
        print(f"Processing: '{clean_title}'")
        if year_hint:
            print(f"  Extracted year: {year_hint}")
        if normalized_media_type:
            print(f"  Media type: {normalized_media_type}")
        
        # Search TMDB
        candidates = search_tmdb(clean_title, TMDB_API_KEY, normalized_media_type, year_hint)

        # Debug: Show similarity scores for ambiguous cases
        if len(candidates) > 1:
            debug_similarity_scores(candidates, clean_title)

        # Decide whether to auto-select or send to manual review
        should_auto, best_candidate, reason = should_auto_select(
            candidates, clean_title, year_hint, normalized_media_type
        )
        
        if should_auto and best_candidate:
            # Auto-add to appropriate list
            item_data = {
                'id': best_candidate['id'],
                'type': best_candidate['media_type']
            }
            
            if normalized_status == 'watchedlist':
                watchedlist_items.append(item_data)
                print(f"  ✅ Auto-added to WATCHEDLIST: {best_candidate['title']} ({best_candidate.get('year', 'N/A')})")
            else:
                watchlist_items.append(item_data)
                print(f"  ✅ Auto-added to WATCHLIST: {best_candidate['title']} ({best_candidate.get('year', 'N/A')})")
            print(f"  Reason: {reason}")
            
        else:
            # Send to manual review
            result_type = "NOT FOUND" if not candidates else f"AMBIGUOUS: {reason}"
            print(f"  ⚠️  {result_type} - Sent for manual review")
            
            # Prepare manual review entry
            suggested_url = create_tmdb_url(clean_title, normalized_media_type or 'movie', year_hint)
            manual_entry = {
                'original_title': original_title,
                'clean_title': clean_title,
                'year_hint': year_hint,
                'media_type_hint': normalized_media_type,
                'status': normalized_status,
                'result_type': result_type,
                'candidate_count': len(candidates),
                'candidates_json': json.dumps(candidates, ensure_ascii=False),
                'suggested_url': suggested_url
            }
            manual_review_items.append(manual_entry)
            
            # Write to CSV immediately
            with open(MANUAL_REVIEW_CSV, 'a', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=manual_entry.keys())
                writer.writerow(manual_entry)
        
        print()  # Empty line for readability
        time.sleep(REQUEST_DELAY)  # Be nice to TMDB API
    
    # Generate final JSON file for web app import
    final_export = {
        "generated_on": datetime.now().isoformat(),
        "watchlist": watchlist_items,
        "watchedlist": watchedlist_items,
        "summary": {
            "total_processed": len(df),
            "auto_added": len(watchlist_items) + len(watchedlist_items),
            "manual_review": len(manual_review_items),
            "watchlist_count": len(watchlist_items),
            "watchedlist_count": len(watchedlist_items)
        }
    }
    
    with open(WATCHLIST_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_export, f, indent=2)
    
    # Print final summary
    print("=" * 50)
    print("📊 PROCESSING COMPLETE")
    print("=" * 50)
    print(f"Total entries processed: {len(df)}")
    print(f"✅ Auto-added to watchlist: {len(watchlist_items)}")
    print(f"✅ Auto-added to watchedlist: {len(watchedlist_items)}")
    print(f"⚠️  Needs manual review: {len(manual_review_items)}")
    print(f"📁 JSON file for web app: {WATCHLIST_JSON_FILE}")
    print(f"📋 Manual review file: {MANUAL_REVIEW_CSV}")
    
    if manual_review_items:
        print(f"\n🔍 For manual review, check '{MANUAL_REVIEW_CSV}'")
        print("   Each entry includes TMDB search URLs and candidate details")

if __name__ == "__main__":
    main()