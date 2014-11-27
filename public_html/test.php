<?php



/*error_reporting(E_ALL);
ini_set('display_errors', 1);

class StyleToCSSConverter {

	private $outputPath = '';
	private $cssStyleMap = [];
	private $classNum = [];
	public $goodExts = [
			'html',
			'htm'
		];
	public $colorsNames = [
		'#FFF'	=> 'white',
		'#FFFFFF'=> 'white',
		'#C0C0C0'=> 'silver',
		'#808080'=> 'gray',
		'#000000'=> 'black',
		'#FF0000'=> 'red',
		'#800000'=> 'maroon',
		'#FFFF00'=> 'yellow',
		'#808000'=> 'olive',
		'#00FF00'=> 'lime',
		'#008000'=> 'green', 
		'#00FFFF'=> 'aqua',
		'#008080'=>	'teal',
		'#0000FF'=> 'blue',
		'#000080'=> 'navy',
		'#FF00FF'=> 'fuchsia',
		'#800080'=> 'purple'
	];
	public $replacePaths = [

	];

	public function run($path) {
		$this->cssStyleMap = [];
		$this->classNum = [];
		chdir($path);
		$this->outputPath = $path . '.new';
		if (!is_dir($this->outputPath)) {
			mkdir($this->outputPath);
		}		
		$this->readDir('.');
		$this->writeFile('style.css', $this->generateCSSFile());
	}

	protected function readDir($path) {
		if ($dh = opendir($path)) {
			while (($file = readdir($dh)) !== false) {
				if ($file == '..' || $file == '.') {
					continue;
				}
				$rpath = $path . '/' . $file;
				if (is_dir($rpath)) {
					$this->readDir($rpath);
				} else {
					$ext = @end(explode('.', $rpath));
					if (in_array($ext, $this->goodExts)) {
						echo $rpath . PHP_EOL;
						$this->processFile($rpath);
					}
				}
			}
		}
	}

	protected function writeFile($file, $content) {
		$dirname = $this->outputPath . substr(dirname($file), 1);
		if (!is_dir($dirname)) {
			mkdir($dirname, 0777, true);
		}
		$filename = $dirname . '/' . basename($file);
		echo '-> ' . $filename . PHP_EOL;
		file_put_contents($filename, $content);
	}

	protected function oldHTMLParamsToCSS($content) {
		preg_match_all('/<([^>]+)>/Ui', preg_replace('<!--(.*?)-->', '', $content), $parts, PREG_SET_ORDER);
		foreach ($parts as $part) {
			preg_match_all('/([a-zA-Z0-9_-]+)="([^"]+)"|([a-zA-Z0-9_-]+)=\'([^\']+)\'|([a-zA-Z0-9_-]+)=([^ >]+)|([^ >]+)/i', $part[1], $parts2, PREG_SET_ORDER);
			$attrs = [];
			$first = true;
			$addStyles = [];
			foreach ($parts2 as $m => $part2) {
				if (isset($part2[7])) {
					if ($first) {
						$tag = strtolower($part2[7]);
						$first = false;
						continue;
					} else {
						$key = $part2[7];
						$value = null;
					}
				} elseif (isset($part2[5])) {
					$key = $part2[5];
					$value = $part2[6];
				} elseif (isset($part2[3])) {
					$key = $part2[3];
					$value = $part2[4];
				} else  {
					$key = $part2[1];
					$value = $part2[2];
				}
				$key = strtolower($key);				
				switch ($key) {
					case 'class':
						if (isset($attrs[$key])) {
							$attrs[$key] .= ' ' . $value;
						} else {
							$attrs[$key] = $value;
						}
					break;
					case 'background':
						$addStyles[] = $this->autoCorrectStyle('background-image: url(\'' . $value . '\');');
					break;
					case 'valign':
						$addStyles[] = $this->autoCorrectStyle('vertical-align: ' . $value);
					break;
					case 'language':
						$attrs['type'] = 'text/' . strtolower($value);
					break;
					case 'align':
						switch (strtolower($value)) {
							case 'absmiddle':
							case 'middle':
								$addStyles[] = $this->autoCorrectStyle('vertical-align: middle');
							break;
							default:
								$addStyles[] = $this->autoCorrectStyle('text-align: ' . $value);
							break;
						}						
					break;
					case 'width':
					case 'height':					
						$addStyles[] = $this->autoCorrectStyle($key . ': ' . $value);
					break;
					case 'border':
						$addStyles[] = $this->autoCorrectStyle('border-width: ' . $value);
						if ($value > 0) {
							$addStyles[] = $this->autoCorrectStyle('border-style: solid;');
						} else {
							$addStyles[] = $this->autoCorrectStyle('border-style: none;');
						}
					break;
					case 'bgcolor':
						$addStyles[] = $this->autoCorrectStyle('background-color: ' . $value);
					break;
					default:
						$attrs[$key] = $value;
				}
			}
			if (count($addStyles) > 0) {
				if (isset($attrs['style'])) {
					$attrs['style'] .= ';' . implode(';', $addStyles) . ';';
				} else {
					$attrs['style'] = implode(';', $addStyles) . ';';
				}
			}
			$attrX = [];
			foreach ($attrs as $key => $value) {
				if ($value === null) {
					$attrX[] = $key;
				} else {
					$attrX[] = $key .'="'. htmlentities($value) . '"';
				}
			}
			$rplTag = '<' . trim( $tag . ' ' . implode(' ', $attrX) ) . '>';
			
			$content = str_replace($part[0], $rplTag, $content);
			
		}
		return $content;
	}

	protected function processFile($file) {
		$content = file_get_contents($file);
		$content = $this->oldHTMLParamsToCSS($content);
		preg_match_all('/<.+(style="([^"]*)"|style=\'([^\']*)\')[^>]*>/Ui', $content, $parts, PREG_SET_ORDER);
		if (count($parts) < 1 || count($parts[1]) < 1) {
			$this->writeFile($file, $content);
			return false;
		}
		foreach ($parts as $i => $part) {
			@list($searchWhat1, $searchWhat2, $css, $css2) = $part;
			if ($css2 !== null) {
				$css = $css2;
			}
			if (strpos($css, '{') > 0) {
				continue;
			}
			$css = $this->autoCorrectStyle($css);
			if ($css === null) {
				continue;
			}
			unset($css2);
			if (isset($this->cssStyleMap[$css])) {
				$class = $this->cssStyleMap[$css];
			} else {
				$class = $this->generateClassName($css, $searchWhat1);
				echo $class . PHP_EOL;
				$this->cssStyleMap[$css] = $class;
			}
			$rplTag = str_replace($searchWhat2, 'class="'.$class.'"', $searchWhat1);
			$parts[$i] = [$searchWhat1, $searchWhat2, $css, $class, $rplTag];
			$content = str_replace($searchWhat1, $rplTag, $content);
			echo "\t" . $i . PHP_EOL;
		}
		$content = $this->oldHTMLParamsToCSS($content);
		$this->writeFile($file, $content);
	}

	protected function generateCSSFile() {
		$ret = '';
		foreach ($this->cssStyleMap as $css => $class) {
			$ret .= '.' . $class . ' {' . PHP_EOL;
			foreach (explode(';', $css) as $part) {
				if (trim($part) == ':' || trim($part) == '') {
					continue;
				}
				$ret .= "\t" . $part . ';' . PHP_EOL;
			}
			$ret .= '}' . PHP_EOL;
		}
		return $ret;
	}

	protected function generateClassName($css, $foundTag) {
		$parts = array_filter(explode(';', $css));
		if (count($parts) == 1) {
			list($name, $value) = explode(':', $parts[0], 2);
			$name = explode('-', $name);
			foreach ($name as $i => $n) {
				$name[$i] = $n{0};
			}
			$name = implode('', $name);
			$value = str_replace([' ', '#', '%', '.'], ['_', 'h', 'p', 't'], trim($value));
			return $name . '-' . $value;
		} else {
			$foundTag = preg_replace("/<([a-z][a-z0-9]*)[^>]*?(\/?)>/i",'$1_$2', $foundTag);
			$foundTag = str_replace([' ', "\t", "/", '{', '}', '(', ')', ':', '[', ']', ',', '<', '>', '!', '.', ';', '&', '-', '__', '__', '__', '__'], '_', trim($foundTag));
			$foundTag = 'tag-' . $foundTag;
			if (strlen($foundTag) > 25) {
				$foundTag = 'sys-c32-' . crc32($foundTag);
			}
			if (isset($this->classNum[$foundTag])) {
				$classNum = ++$this->classNum[$foundTag];
			} else {
				$classNum = $this->classNum[$foundTag] = 1;
			}
			$i = 1;			
			return str_replace('_-', '-', $foundTag . '-' . $classNum);
		}
	}

	protected function addUnitsifNeeded($value) {
		$v2 = strval(intval($value));
		if ($v2 == $value) {
			$value .= 'px';
		}
		return $value;
	}

	protected function autoCorrectColor($value) {
		$value = trim($value);
		if (strlen($value) === 6 && preg_match('/[0-9ABCDEFabcdef]+/Ui', $value)) {
			$value = '#' . $value;
		}
		$name = strtoupper($value);
		if (isset($this->colorsNames[$name])) {
			$value = $this->colorsNames[$name];
		}	

		return $value;
	}

	protected function autoCorrectStyle($style) {
		$parts = explode(';', $style . ';');
		$aparts = [];
		foreach ($parts as $i => $part) {
			$xparts = explode(':', $part, 2);
			$xparts = array_map('trim', $xparts);
			if (count($xparts) == 1) {
				$xparts[] = null;
			}
			list($name, $value) = $xparts;
			if (strpos($value, '{')) {
				return null;
			}
			$name = strtolower($name);
			switch ($name) {
				case 'valign':
					$name = 'vertical-align';
				break;
				case 'border':
				case 'border-left':
				case 'border-top':
				case 'border-right':
				case 'border-bottom':
					list($width, $style, $color) = explode(' ', $value);
					if ($style ===  null) {
						$style = $width;
						$width = 'inherit';
					}
					if ($color === null) {
						$color = 'inherit';
					}
					$color = $this->autoCorrectColor($color);
					$aparts[] = sprintf('%s-color: %s', $name, $color);
					$aparts[] = sprintf('%s-width: %s', $name, $width);
					$aparts[] = sprintf('%s-style: %s', $name, $style);
					$value = $name = null;					
				break;
				case 'color':
				case 'background-color':
					$value = $this->autoCorrectColor($value);
				break;
				case 'padding':
				case 'margin':
					if ($value != '0') {
						$parts2 = explode(' ', $value);
						foreach ($parts2 as $o => $v3) {
							$parts2[$o] = $this->addUnitsifNeeded($v3);
						}
						$value = implode(' ', $parts2);
					}
				break;
				case 'padding-left':
				case 'padding-top':
				case 'padding-right':
				case 'padding-bottom':
				case 'margin-left':
				case 'margin-top':
				case 'margin-right':
				case 'margin-bottom':
				case 'height':
				case 'width':
				case 'font-size':
					$value = $this->addUnitsifNeeded($value);
				break;
			}
			if ($name !== null) {
				$parts[$i] = $name . ': ' . $value;
			} else {
				$parts[$i] = null;
			}
		}
		$style = [];
		foreach ($parts + $aparts as $part) {
			$part = trim($part);
			if ($part === '' || $part === ':') {
				continue;
			}
			$style[] = $part;
		}

		$style = implode('; ', $style) . ';';
		preg_match_all('/url\(([\s])?([\"|\'])?(.*?)([\"|\'])?([\s])?\)/i', $style, $matches, PREG_PATTERN_ORDER);
		if (!empty($matches[0])) {
			foreach ($matches[3] as $i => $match) {
				foreach ($this->replacePaths as $oPath => $nPath) {
				    $l = strlen($oPath);
					if (substr($match, 0, $l) == $oPath) {
						$match = $nPath . substr($match, $l);
					}
				}
				$style = str_replace($matches[0], 'url("' . $this->convertURLToData($match) . '")', $style);
			}
		}		
		return $style;
	}

	protected function convertURLToData($url) {
		if (!(
			(substr($url, 0, 7) == 'http://') || 
			(substr($url, 0, 8) == 'https://') ||
			(substr($url, 0, 6) == 'ftp://') ||
			(substr($url, 0, 10) == 'gopther://')
			))
				return $url;

		$ch = curl_init();
	
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
		$data = curl_exec($ch);
		$info = curl_getinfo($ch);
		curl_close($ch);

		$mt = explode(';', $info['content_type']);
		$ret = 'data:' . $mt[0] . ';base64,' . base64_encode($data);

		return $ret;
	}

}

$conv = new StyleToCSSConverter();
$conv->replacePaths = [
	'../../i/' => 'http://games.lt/i/',
	'../i/' => 'http://games.lt/i/',
	'i/' => 'http://games.lt/i/',
];
$conv->run(dirname(dirname(__DIR__)) . '/test.mekdrop.name/public_html/games.lt/moon');*/