#!/bin/bash

function mpvr() {
	local max_retries=3
	local retry_count=0
	local exit_code=1

	while [[ $retry_count -lt $max_retries ]]; do
		command mpv "$@"
		exit_code=$?

		if [[ $exit_code -eq 0 ]]; then
			return 0
		fi

		retry_count=$((retry_count + 1))
		echo "mpv failed with exit code $exit_code, retrying... ($retry_count/$max_retries)"
		sleep 1
	done

	echo "mpv failed after $max_retries attempts"
	return $exit_code
}

mpvr "$@"
