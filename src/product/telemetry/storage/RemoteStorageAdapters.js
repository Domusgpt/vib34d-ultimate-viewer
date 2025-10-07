const DEFAULT_CONTENT_TYPE = 'application/json';

function resolveFetch(customFetch) {
    if (customFetch) {
        return customFetch;
    }
    if (typeof fetch === 'function') {
        return fetch.bind(globalThis);
    }
    throw new Error('[RemoteStorageAdapters] No fetch implementation available. Provide one via `fetchImplementation`.');
}

function serializeRecords(records, serializer) {
    if (typeof serializer === 'function') {
        return serializer(records);
    }

    return JSON.stringify({
        exportedAt: new Date().toISOString(),
        recordCount: Array.isArray(records) ? records.length : 0,
        records
    });
}

export function createSignedS3StorageAdapter(options = {}) {
    const {
        signingEndpoint,
        signingMethod = 'POST',
        signingHeaders,
        signingPayload,
        uploadMethod = 'PUT',
        fetchImplementation,
        uploadHeaders,
        serialize = (records) => serializeRecords(records, options.serialize),
        onUploadComplete,
        onError,
        deleteEndpoint,
        deleteMethod = 'DELETE'
    } = options;

    const fetchFn = resolveFetch(fetchImplementation);

    async function obtainUploadTarget(payloadMetadata = {}) {
        if (!signingEndpoint) {
            throw new Error('[createSignedS3StorageAdapter] `signingEndpoint` is required.');
        }

        const response = await fetchFn(signingEndpoint, {
            method: signingMethod,
            headers: {
                'content-type': DEFAULT_CONTENT_TYPE,
                ...signingHeaders
            },
            body: JSON.stringify({
                operation: 'PUT_OBJECT',
                ...signingPayload,
                ...payloadMetadata
            })
        });

        if (!response.ok) {
            const error = new Error(`[createSignedS3StorageAdapter] Failed to obtain signed URL (${response.status})`);
            onError?.(error);
            throw error;
        }

        const data = await response.json();
        if (!data?.uploadUrl) {
            const error = new Error('[createSignedS3StorageAdapter] Signing endpoint did not return `uploadUrl`.');
            onError?.(error);
            throw error;
        }

        return data;
    }

    return {
        async write(records) {
            try {
                if (!Array.isArray(records) || records.length === 0) {
                    return;
                }

                const payload = serialize(records);
                const target = await obtainUploadTarget({ recordCount: records.length });
                const response = await fetchFn(target.uploadUrl, {
                    method: uploadMethod,
                    headers: {
                        'content-type': DEFAULT_CONTENT_TYPE,
                        ...target.headers,
                        ...uploadHeaders
                    },
                    body: typeof payload === 'string' ? payload : JSON.stringify(payload)
                });

                if (!response.ok) {
                    const error = new Error(`[createSignedS3StorageAdapter] Upload failed (${response.status})`);
                    onError?.(error);
                    throw error;
                }

                onUploadComplete?.({
                    key: target.key,
                    location: target.uploadUrl,
                    recordCount: records.length
                });
            } catch (error) {
                onError?.(error);
                throw error;
            }
        },
        async clear() {
            if (!deleteEndpoint) {
                return;
            }

            const response = await fetchFn(deleteEndpoint, {
                method: deleteMethod,
                headers: signingHeaders
            });

            if (!response.ok) {
                const error = new Error(`[createSignedS3StorageAdapter] Failed to clear remote vault (${response.status})`);
                onError?.(error);
                throw error;
            }
        },
        async read() {
            return [];
        }
    };
}

export function createLogBrokerStorageAdapter(options = {}) {
    const {
        endpoint,
        method = 'POST',
        headers,
        fetchImplementation,
        serialize = (records) => serializeRecords(records, options.serialize),
        onError
    } = options;

    if (!endpoint) {
        throw new Error('[createLogBrokerStorageAdapter] `endpoint` is required.');
    }

    const fetchFn = resolveFetch(fetchImplementation);

    return {
        async write(records) {
            try {
                if (!Array.isArray(records) || records.length === 0) {
                    return;
                }

                const body = serialize(records);
                const response = await fetchFn(endpoint, {
                    method,
                    headers: {
                        'content-type': DEFAULT_CONTENT_TYPE,
                        ...headers
                    },
                    body: typeof body === 'string' ? body : JSON.stringify(body)
                });

                if (!response.ok) {
                    const error = new Error(`[createLogBrokerStorageAdapter] Failed to deliver compliance batch (${response.status})`);
                    onError?.(error);
                    throw error;
                }
            } catch (error) {
                onError?.(error);
                throw error;
            }
        },
        async clear() {
            // Log brokers typically treat new uploads as append-only; clearing is a no-op.
        },
        async read() {
            return [];
        }
    };
}
