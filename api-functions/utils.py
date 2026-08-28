"""
Utility functions for deep cloning and object manipulation.

Provides deep copy capabilities for job objects, result structures, and
request/response payloads without external dependencies.
"""

import copy
import json
import logging
from typing import Any, Dict, List, Optional, TypeVar, Union

logger = logging.getLogger(__name__)

T = TypeVar("T")


def deep_clone(obj: T) -> T:
    """
    Create a deep copy of an object using copy.deepcopy.
    
    Safe for most Python objects including dicts, lists, primitives.
    Handles circular references gracefully.
    
    Args:
        obj: Any Python object
        
    Returns:
        A deep copy of the object
        
    Example:
        >>> job = {"job_id": "123", "params": {"key": "value"}}
        >>> cloned = deep_clone(job)
        >>> cloned["params"]["key"] = "modified"
        >>> job["params"]["key"]  # Still "value"
        'value'
    """
    try:
        return copy.deepcopy(obj)
    except TypeError as e:
        logger.warning(f"Could not deep clone {type(obj)}: {e}. Falling back to JSON serialization.")
        return json_clone(obj)


def json_clone(obj: T) -> T:
    """
    Deep clone via JSON serialization and deserialization.
    
    Works for any JSON-serializable object. Loses non-serializable types
    (functions, custom classes, etc.) but safe for most data structures.
    
    Args:
        obj: A JSON-serializable object
        
    Returns:
        A cloned object
        
    Example:
        >>> data = {"name": "test", "items": [1, 2, 3]}
        >>> cloned = json_clone(data)
    """
    try:
        return json.loads(json.dumps(obj))
    except (TypeError, ValueError) as e:
        logger.error(f"JSON clone failed: {e}")
        raise ValueError(f"Object is not JSON-serializable: {obj}") from e


def clone_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep clone a job object, ensuring all nested structures are independent.
    
    Useful for creating job copies for retry logic, archival, or worker processing
    without affecting the original job reference.
    
    Args:
        job: A job dictionary with keys like job_id, status, params, etc.
        
    Returns:
        A completely independent clone of the job
        
    Example:
        >>> original = {"job_id": "abc", "status": "queued", "params": {"x": 1}}
        >>> copy_for_retry = clone_job(original)
        >>> copy_for_retry["status"] = "processing"
        >>> original["status"]  # Still "queued"
        'queued'
    """
    return deep_clone(job)


def clone_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep clone a job result object.
    
    Ensures result data can be safely archived or transformed without
    affecting the original result reference.
    
    Args:
        result: A result dictionary
        
    Returns:
        An independent copy of the result
    """
    return deep_clone(result)


def clone_list(items: List[T]) -> List[T]:
    """
    Deep clone a list and all its elements.
    
    Args:
        items: A list of items
        
    Returns:
        A new list with deeply cloned elements
    """
    return [deep_clone(item) for item in items]


def merge_cloned(base: Dict[str, Any], *overrides: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new dict by merging a base object with override dicts.
    
    Does not mutate the base or any override dicts. All input dicts are
    cloned before merging.
    
    Args:
        base: The base dictionary
        *overrides: Dictionaries to merge in order
        
    Returns:
        A new merged dictionary
        
    Example:
        >>> base = {"job_id": "123", "status": "queued"}
        >>> updated = merge_cloned(base, {"status": "running", "worker_id": "w1"})
        >>> base["status"]  # Still "queued"
        'queued'
        >>> updated["status"]  # Now "running"
        'running'
    """
    result = deep_clone(base)
    for override in overrides:
        result.update(deep_clone(override))
    return result


def selective_clone(obj: Dict[str, Any], keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Clone only specific keys from a dictionary.
    
    Useful for extracting and cloning a subset of job or result data
    without the full object.
    
    Args:
        obj: Source dictionary
        keys: List of keys to clone. If None, clones all keys.
        
    Returns:
        A new dict with only the specified keys
        
    Example:
        >>> job = {"job_id": "123", "status": "queued", "token": "secret"}
        >>> safe_copy = selective_clone(job, ["job_id", "status"])
        >>> "token" in safe_copy  # False
        False
    """
    if keys is None:
        return deep_clone(obj)
    return {key: deep_clone(obj[key]) for key in keys if key in obj}
