<?php

class INI {

	public static function fromArray($data) {
		$ret = '';
		foreach ($data as $cat => $items) {
			$ret .= "[" . $car . "]\n";
			foreach ($items as $name => $value) {
				$ret .= $name ."=" . str_replace("\n", "\\n", $value) . "\n";
			}
		}
		return $ret;
	}

	public static function fromINI($data) {
		$ret = [];
		$parts = explode("\n", $data);
		$cat = 'Global';
		foreach ($parts as $line) {
			switch($line{0}) {
				case ';':
				case '#':
					// comment... skiping...
				break;
				case '[':
					$cat .= substr($line, 1, -1);
				break;
				default:
					list($key, $value) = explode('=', $line, 2);
					$value = str_replace("\\n", "\n", $value);
					$ret[$cat][$key] = $value;
			}
		}
	}

}