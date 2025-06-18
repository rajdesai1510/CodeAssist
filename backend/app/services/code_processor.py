from typing import Dict, List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
import logging
from app.models.template import Template
import json
import requests
import re
from bs4 import BeautifulSoup

# Add missing imports for Groq API
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Set up Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
}

logger = logging.getLogger(__name__)

class CodeProcessor:
    def __init__(self):
        # Use RecursiveCharacterTextSplitter with specific separators for HTML and CSS
        self.html_splitter = RecursiveCharacterTextSplitter(
            separators=["</body>", "</html>", "</div>", "</section>", "</main>", "\n\n", "\n", " "],
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
        self.css_splitter = RecursiveCharacterTextSplitter(
            separators=["}}", "}", "{", ";", "\n\n", "\n", " "],
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )

    def process_template(self, template: Template, user_requirements: str) -> Dict[str, str]:
        """Process template HTML and CSS with user requirements"""
        try:
            # Split HTML and CSS into manageable chunks
            html_chunks = self._split_html(template.html_content)
            css_chunks = self._split_css(template.css_content)
            
            # Process HTML chunks
            processed_html = self._process_html_chunks(html_chunks, user_requirements)
            
            # Process CSS chunks
            processed_css = self._process_css_chunks(css_chunks, user_requirements)
            
            return {
                "html": processed_html,
                "css": processed_css
            }
        except Exception as e:
            logger.error(f"Error processing template: {str(e)}")
            raise

    def _split_html(self, html_content: str) -> List[str]:
        """Split HTML content into manageable chunks"""
        return self.html_splitter.split_text(html_content)

    def _split_css(self, css_content: str) -> List[str]:
        """Split CSS content into manageable chunks"""
        return self.css_splitter.split_text(css_content)

    def _process_html_chunks(self, chunks: List[str], user_requirements: str) -> str:
        """Process HTML chunks with user requirements"""
        processed_chunks = []
        structure_context = self._extract_structure_context(chunks[0])
        
        for i, chunk in enumerate(chunks):
            # Create a focused prompt for each chunk
            prompt = self._create_html_chunk_prompt(
                chunk, 
                structure_context,
                user_requirements,
                is_first=i == 0,
                is_last=i == len(chunks) - 1
            )
            
            # Process chunk with LLM
            processed_chunk = self._process_chunk_with_llm(prompt, "html")
            processed_chunks.append(processed_chunk)
        
        return self._merge_html_chunks(processed_chunks)

    def _process_css_chunks(self, chunks: List[str], user_requirements: str) -> str:
        """Process CSS chunks with user requirements"""
        processed_chunks = []
        style_context = self._extract_style_context(chunks[0])
        
        for i, chunk in enumerate(chunks):
            # Create a focused prompt for each chunk
            prompt = self._create_css_chunk_prompt(
                chunk,
                style_context,
                user_requirements,
                is_first=i == 0,
                is_last=i == len(chunks) - 1
            )
            
            # Process chunk with LLM
            processed_chunk = self._process_chunk_with_llm(prompt, "css")
            processed_chunks.append(processed_chunk)
        
        return self._merge_css_chunks(processed_chunks)

    def _extract_structure_context(self, first_chunk: str) -> str:
        """Extract structural context from the first HTML chunk"""
        # Extract key structural elements like doctype, head, main layout divs
        return self._summarize_structure(first_chunk)

    def _extract_style_context(self, first_chunk: str) -> str:
        """Extract style context from the first CSS chunk"""
        # Extract key style elements like color schemes, main layout styles
        return self._summarize_styles(first_chunk)

    def _create_html_chunk_prompt(self, chunk: str, structure_context: str, 
                                user_requirements: str, is_first: bool, 
                                is_last: bool) -> str:
        """Create a focused prompt for processing an HTML chunk"""
        return f"""Process this HTML chunk while maintaining the overall structure and incorporating user requirements.
        
        Structure Context: {structure_context}
        User Requirements: {user_requirements}
        
        Special Instructions:
        {f'This is the first chunk - maintain DOCTYPE and head section' if is_first else ''}
        {f'This is the last chunk - ensure proper closing of all elements' if is_last else ''}
        
        Original Chunk:
        {chunk}
        
        Modify the chunk to meet user requirements while maintaining structure and compatibility with other chunks.
        Return only the modified HTML, no explanations.
        """

    def _create_css_chunk_prompt(self, chunk: str, style_context: str,
                               user_requirements: str, is_first: bool,
                               is_last: bool) -> str:
        """Create a focused prompt for processing a CSS chunk"""
        return f"""Process this CSS chunk while maintaining the overall style scheme and incorporating user requirements.
        
        Style Context: {style_context}
        User Requirements: {user_requirements}
        
        Special Instructions:
        {f'This is the first chunk - maintain global styles and variables' if is_first else ''}
        {f'This is the last chunk - ensure all styles are properly closed' if is_last else ''}
        
        Original Chunk:
        {chunk}
        
        Modify the chunk to meet user requirements while maintaining style consistency and compatibility with other chunks.
        Return only the modified CSS, no explanations.
        """

    def _process_chunk_with_llm(self, prompt: str, chunk_type: str) -> str:
        """Process a single chunk with the LLM"""
        try:
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": f"You are a specialized {chunk_type.upper()} processor. Return only valid {chunk_type.upper()} code, no explanations."
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 1500
            }
            
            response = requests.post(
                GROQ_API_URL,
                headers=GROQ_HEADERS,
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content'].strip()
            else:
                logger.error(f"Error processing chunk: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error in LLM processing: {str(e)}")
            return None

    def _merge_html_chunks(self, chunks: List[str]) -> str:
        """Merge processed HTML chunks back together"""
        merged = "\n".join(chunks)
        # Clean up any duplicate doctypes or head sections
        # Ensure proper nesting of elements
        return self._clean_html(merged)

    def _merge_css_chunks(self, chunks: List[str]) -> str:
        """Merge processed CSS chunks back together"""
        merged = "\n".join(chunks)
        # Clean up any duplicate variable declarations
        # Ensure proper CSS syntax
        return self._clean_css(merged)

    def _summarize_structure(self, html: str) -> str:
        """Extract and summarize key structural elements from HTML"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract key structural information
            doctype = "<!DOCTYPE html>" if "<!DOCTYPE html>" in html else ""
            head_content = soup.head.prettify() if soup.head else ""
            body_classes = soup.body.get('class', []) if soup.body else []
            main_containers = [tag.name for tag in soup.find_all(['main', 'div', 'section']) if 'container' in tag.get('class', [])]
            
            structure_summary = f"""
            {doctype}
            Head: {bool(head_content)}
            Body Classes: {', '.join(body_classes)}
            Main Containers: {', '.join(main_containers)}
            """
            return structure_summary.strip()
        except Exception as e:
            logger.error(f"Error summarizing HTML structure: {str(e)}")
            return html[:200]  # Return first 200 chars as fallback

    def _summarize_styles(self, css: str) -> str:
        """Extract and summarize key style elements from CSS"""
        try:
            # Extract CSS variables
            css_vars = re.findall(r'--[\w-]+:', css)
            
            # Extract main selectors
            main_selectors = re.findall(r'(?:^|\})\s*([^{]+?)\s*\{', css)
            
            # Extract media queries
            media_queries = re.findall(r'@media[^{]+\{', css)
            
            style_summary = f"""
            CSS Variables: {', '.join(css_vars[:5])}
            Main Selectors: {', '.join(main_selectors[:5])}
            Media Queries: {len(media_queries)}
            """
            return style_summary.strip()
        except Exception as e:
            logger.error(f"Error summarizing CSS styles: {str(e)}")
            return css[:200]  # Return first 200 chars as fallback

    def _clean_html(self, html: str) -> str:
        """Clean up merged HTML content"""
        try:
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove duplicate doctypes (keep only the first one)
            doctypes = soup.find_all('doctype')
            if len(doctypes) > 1:
                for doctype in doctypes[1:]:
                    doctype.decompose()
            
            # Remove duplicate head sections (keep only the first one)
            heads = soup.find_all('head')
            if len(heads) > 1:
                for head in heads[1:]:
                    head.decompose()
            
            # Remove duplicate body tags (keep only the first one)
            bodies = soup.find_all('body')
            if len(bodies) > 1:
                for body in bodies[1:]:
                    body.unwrap()  # Keep content but remove duplicate body tags
            
            return str(soup)
        except Exception as e:
            logger.error(f"Error cleaning HTML: {str(e)}")
            return html

    def _clean_css(self, css: str) -> str:
        """Clean up merged CSS content"""
        try:
            # Remove duplicate variable declarations
            seen_vars = set()
            cleaned_lines = []
            
            for line in css.split('\n'):
                if '--' in line:
                    var_name = re.search(r'(--[\w-]+):', line)
                    if var_name and var_name.group(1) not in seen_vars:
                        seen_vars.add(var_name.group(1))
                        cleaned_lines.append(line)
                else:
                    cleaned_lines.append(line)
            
            # Remove empty rules
            css = re.sub(r'[^}]+\{\s*\}', '', '\n'.join(cleaned_lines))
            
            # Remove duplicate media queries
            seen_media = set()
            final_lines = []
            
            media_block = []
            in_media = False
            
            for line in css.split('\n'):
                if line.strip().startswith('@media'):
                    in_media = True
                    media_block = [line]
                elif in_media:
                    media_block.append(line)
                    if line.strip() == '}':
                        in_media = False
                        media_content = '\n'.join(media_block)
                        if media_content not in seen_media:
                            seen_media.add(media_content)
                            final_lines.extend(media_block)
                else:
                    final_lines.append(line)
            
            return '\n'.join(final_lines)
        except Exception as e:
            logger.error(f"Error cleaning CSS: {str(e)}")
            return css

    def _clean_html(self, html: str) -> str:
        """Clean up merged HTML content"""
        # Remove duplicate doctypes
        # Fix any broken tags
        # Ensure proper structure
        return html

    def _clean_css(self, css: str) -> str:
        """Clean up merged CSS content"""
        # Remove duplicate variable declarations
        # Fix any broken rules
        # Ensure proper syntax
        return css

    def _summarize_structure(self, html: str) -> str:
        """Extract and summarize key structural elements from HTML"""
        # Implementation to extract key structural elements
        pass

    def _summarize_styles(self, css: str) -> str:
        """Extract and summarize key style elements from CSS"""
        # Implementation to extract key style elements
        pass 