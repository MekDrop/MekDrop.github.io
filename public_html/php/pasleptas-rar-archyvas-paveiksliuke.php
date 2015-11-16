<?php

ini_set('memory_limit', '100M');
set_time_limit(0);

if (isset($_FILES["source"]) && is_array($_FILES["source"])) {
	$uploads_dir = sys_get_temp_dir() . '/' . basename(__FILE__) . '_' . md5(microtime(true));
	mkdir($uploads_dir, 0777, true);
	chdir($uploads_dir);
	$files = [];
	foreach ($_FILES["source"]["error"] as $key => $error) {
	    if ($error == UPLOAD_ERR_OK) {
		    $tmp_name = $_FILES["source"]["tmp_name"][$key];
	        $files[] = $name = $_FILES["source"]["name"][$key];
			if (!isset($type)) {
				$type = $_FILES["source"]["type"][$key];
			}
			move_uploaded_file($tmp_name, "$uploads_dir/$name");
		}
	}
	exec('rar a -k -inul rar.rar ' . implode(' ', array_slice($files, 1)));

	$nfile = 'new_' . $files[0];
	exec('cat ' . $files[0] . ' rar.rar > ' . $nfile);
	foreach ($files as $filename) {
		unlink($filename);
	}

	$ret = [
		$nfile,
		'data:' . $type . ';base64,' . base64_encode(file_get_contents($nfile))
	];

	unlink('new_' . $files[0]);
	chdir('..');
	rmdir($uploads_dir);

	echo json_encode($ret);
}