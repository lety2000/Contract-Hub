#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Vertragsmanager
Testing contract management, authentication, and export functionality
"""
import requests
import json
import base64
import time
import os
from datetime import datetime

# Use the production URL from frontend/.env
BACKEND_URL = "https://vertrag-hub-1.preview.emergentagent.com/api"

class VertragsmanagerAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        self.created_family_members = []
        self.created_contracts = []
        
    def set_auth_header(self):
        """Set authorization header for authenticated requests"""
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        
        try:
            # Test root endpoint
            response = self.session.get(f"{self.base_url}/")
            print(f"✓ GET / - Status: {response.status_code}")
            if response.status_code == 200:
                print(f"  Response: {response.json()}")
            else:
                print(f"  ❌ Expected 200, got {response.status_code}")
                return False
            
            # Test health endpoint
            response = self.session.get(f"{self.base_url}/health")
            print(f"✓ GET /health - Status: {response.status_code}")
            if response.status_code == 200:
                print(f"  Response: {response.json()}")
            else:
                print(f"  ❌ Expected 200, got {response.status_code}")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        print("\n=== USER REGISTRATION TEST ===")
        
        try:
            user_data = {
                "username": "testuser_manager",
                "password": "TestPassword123!",
                "email": "testuser@vertragsmanager.de"
            }
            
            response = self.session.post(f"{self.base_url}/auth/register", json=user_data)
            print(f"✓ POST /auth/register - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["token"]
                self.user_id = data["user"]["id"]
                print(f"  ✓ User registered successfully")
                print(f"  ✓ Token received: {self.token[:20]}...")
                print(f"  ✓ User ID: {self.user_id}")
                self.set_auth_header()
                return True
            else:
                print(f"  ❌ Registration failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Registration test failed: {e}")
            return False
    
    def test_user_login(self):
        """Test user login"""
        print("\n=== USER LOGIN TEST ===")
        
        try:
            login_data = {
                "username": "testuser_manager",
                "password": "TestPassword123!"
            }
            
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            print(f"✓ POST /auth/login - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["token"]
                self.user_id = data["user"]["id"]
                print(f"  ✓ Login successful")
                print(f"  ✓ Token: {self.token[:20]}...")
                self.set_auth_header()
                return True
            else:
                print(f"  ❌ Login failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Login test failed: {e}")
            return False
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        print("\n=== GET CURRENT USER TEST ===")
        
        try:
            response = self.session.get(f"{self.base_url}/auth/me")
            print(f"✓ GET /auth/me - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  ✓ Current user retrieved: {data['username']}")
                return True
            else:
                print(f"  ❌ Get current user failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Get current user test failed: {e}")
            return False
    
    def test_family_member_crud(self):
        """Test family member CRUD operations"""
        print("\n=== FAMILY MEMBER CRUD TESTS ===")
        
        try:
            # Create family members
            family_members = [
                {"name": "Maria Schmidt", "relationship": "Ehepartnerin"},
                {"name": "Max Schmidt", "relationship": "Kind"}
            ]
            
            for member_data in family_members:
                response = self.session.post(f"{self.base_url}/family-members", json=member_data)
                print(f"✓ POST /family-members - Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.created_family_members.append(data["id"])
                    print(f"  ✓ Family member created: {data['name']} ({data['relationship']})")
                else:
                    print(f"  ❌ Create family member failed - Status: {response.status_code}")
                    print(f"  Response: {response.text}")
                    return False
            
            # Get family members list
            response = self.session.get(f"{self.base_url}/family-members")
            print(f"✓ GET /family-members - Status: {response.status_code}")
            
            if response.status_code == 200:
                members = response.json()
                print(f"  ✓ Retrieved {len(members)} family members")
                for member in members:
                    print(f"    - {member['name']} ({member['relationship']})")
                return True
            else:
                print(f"  ❌ Get family members failed - Status: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Family member CRUD test failed: {e}")
            return False
    
    def test_contract_crud(self):
        """Test contract CRUD operations - MAIN FOCUS"""
        print("\n=== CONTRACT CRUD TESTS (MAIN FOCUS) ===")
        
        try:
            # Sample base64 PDF content for testing
            sample_pdf_b64 = "JVBERi0xLjQKJcfsj6IKNSAwIG9iago8PAovTGVuZ3RoIDYgMCBSCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nDM0MDAw"
            
            # Create contracts with different categories and data
            contracts_data = [
                {
                    "name": "KFZ-Versicherung BMW",
                    "provider": "ADAC Versicherung",
                    "category": "Versicherungen",
                    "cost": 89.50,
                    "cost_interval": "monatlich",
                    "family_member_id": self.created_family_members[0] if self.created_family_members else None,
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "cancellation_period": "3 Monate",
                    "contract_number": "KFZ-2024-001",
                    "contact_person": "Hans Mueller",
                    "contact_phone": "+49 30 12345678",
                    "contact_email": "hans.mueller@adac.de",
                    "notes": "Vollkasko mit 500€ Selbstbeteiligung",
                    "tags": ["wichtig", "auto", "versicherung"],
                    "documents": [
                        {
                            "name": "Versicherungsschein.pdf",
                            "content_base64": sample_pdf_b64,
                            "mime_type": "application/pdf"
                        }
                    ],
                    "reminders": [
                        {
                            "title": "Kündigungsfrist prüfen",
                            "date": "2024-09-30",
                            "description": "Rechtzeitig vor Ablauf kündigen"
                        }
                    ]
                },
                {
                    "name": "Netflix Premium",
                    "provider": "Netflix Deutschland",
                    "category": "Abonnements",
                    "cost": 17.99,
                    "cost_interval": "monatlich",
                    "family_member_id": self.created_family_members[1] if len(self.created_family_members) > 1 else None,
                    "start_date": "2023-06-15",
                    "cancellation_period": "Jederzeit",
                    "tags": ["entertainment", "streaming"],
                    "documents": [],
                    "reminders": []
                },
                {
                    "name": "Stromvertrag Wohnung",
                    "provider": "Stadtwerke München",
                    "category": "Energie",
                    "cost": 2400.00,
                    "cost_interval": "jährlich",
                    "start_date": "2023-01-01",
                    "end_date": "2025-12-31",
                    "contract_number": "STROM-2023-4567",
                    "contact_phone": "089 123456789",
                    "notes": "Ökostrom-Tarif mit Preisgarantie bis Ende 2024",
                    "tags": ["energie", "ökostrom"],
                    "documents": [],
                    "reminders": []
                }
            ]
            
            # CREATE contracts
            for contract_data in contracts_data:
                response = self.session.post(f"{self.base_url}/contracts", json=contract_data)
                print(f"✓ POST /contracts - Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.created_contracts.append(data["id"])
                    print(f"  ✓ Contract created: {data['name']} ({data['category']})")
                    print(f"    - Cost: {data['cost']} EUR/{data['cost_interval']}")
                    print(f"    - Provider: {data['provider']}")
                    if data.get('family_member_id'):
                        print(f"    - Family Member ID: {data['family_member_id']}")
                    print(f"    - Documents: {len(data.get('documents', []))}")
                    print(f"    - Reminders: {len(data.get('reminders', []))}")
                else:
                    print(f"  ❌ Create contract failed - Status: {response.status_code}")
                    print(f"  Response: {response.text}")
                    return False
            
            # READ contracts - Get all
            response = self.session.get(f"{self.base_url}/contracts")
            print(f"\n✓ GET /contracts - Status: {response.status_code}")
            
            if response.status_code == 200:
                contracts = response.json()
                print(f"  ✓ Retrieved {len(contracts)} contracts")
                for contract in contracts:
                    print(f"    - {contract['name']} ({contract['category']})")
            else:
                print(f"  ❌ Get contracts failed - Status: {response.status_code}")
                return False
            
            # READ contracts - Test filters
            print(f"\n--- Testing contract filters ---")
            
            # Filter by category
            response = self.session.get(f"{self.base_url}/contracts?category=Versicherungen")
            print(f"✓ GET /contracts?category=Versicherungen - Status: {response.status_code}")
            if response.status_code == 200:
                filtered = response.json()
                print(f"  ✓ Found {len(filtered)} insurance contracts")
            
            # Filter by family member
            if self.created_family_members:
                response = self.session.get(f"{self.base_url}/contracts?family_member_id={self.created_family_members[0]}")
                print(f"✓ GET /contracts?family_member_id=... - Status: {response.status_code}")
                if response.status_code == 200:
                    filtered = response.json()
                    print(f"  ✓ Found {len(filtered)} contracts for family member")
            
            # READ single contract
            if self.created_contracts:
                contract_id = self.created_contracts[0]
                response = self.session.get(f"{self.base_url}/contracts/{contract_id}")
                print(f"\n✓ GET /contracts/{contract_id} - Status: {response.status_code}")
                
                if response.status_code == 200:
                    contract = response.json()
                    print(f"  ✓ Retrieved single contract: {contract['name']}")
                else:
                    print(f"  ❌ Get single contract failed - Status: {response.status_code}")
                    return False
            
            # UPDATE contract
            if self.created_contracts:
                contract_id = self.created_contracts[0]
                update_data = {
                    "cost": 95.00,
                    "notes": "Updated: Selbstbeteiligung auf 300€ reduziert",
                    "tags": ["wichtig", "auto", "versicherung", "aktualisiert"]
                }
                
                response = self.session.put(f"{self.base_url}/contracts/{contract_id}", json=update_data)
                print(f"\n✓ PUT /contracts/{contract_id} - Status: {response.status_code}")
                
                if response.status_code == 200:
                    updated_contract = response.json()
                    print(f"  ✓ Contract updated successfully")
                    print(f"    - New cost: {updated_contract['cost']} EUR")
                    print(f"    - New notes: {updated_contract['notes'][:50]}...")
                    print(f"    - Tags: {updated_contract['tags']}")
                else:
                    print(f"  ❌ Update contract failed - Status: {response.status_code}")
                    print(f"  Response: {response.text}")
                    return False
            
            # Test document operations
            if self.created_contracts:
                contract_id = self.created_contracts[1]  # Use Netflix contract
                
                # Add document
                doc_data = {
                    "name": "Rechnung_März_2024.pdf",
                    "content_base64": sample_pdf_b64,
                    "mime_type": "application/pdf"
                }
                
                response = self.session.post(f"{self.base_url}/contracts/{contract_id}/documents", json=doc_data)
                print(f"\n✓ POST /contracts/{contract_id}/documents - Status: {response.status_code}")
                
                if response.status_code == 200:
                    document = response.json()
                    doc_id = document["id"]
                    print(f"  ✓ Document added: {document['name']}")
                    
                    # Remove document  
                    response = self.session.delete(f"{self.base_url}/contracts/{contract_id}/documents/{doc_id}")
                    print(f"✓ DELETE /contracts/{contract_id}/documents/{doc_id} - Status: {response.status_code}")
                    
                    if response.status_code == 200:
                        print(f"  ✓ Document deleted successfully")
                    else:
                        print(f"  ❌ Delete document failed - Status: {response.status_code}")
                else:
                    print(f"  ❌ Add document failed - Status: {response.status_code}")
            
            return True
            
        except Exception as e:
            print(f"❌ Contract CRUD test failed: {e}")
            return False
    
    def test_statistics_api(self):
        """Test statistics endpoint"""
        print("\n=== STATISTICS API TEST ===")
        
        try:
            response = self.session.get(f"{self.base_url}/statistics")
            print(f"✓ GET /statistics - Status: {response.status_code}")
            
            if response.status_code == 200:
                stats = response.json()
                print(f"  ✓ Statistics retrieved successfully")
                print(f"    - Total contracts: {stats.get('total_contracts', 0)}")
                print(f"    - Monthly cost: {stats.get('total_monthly_cost', 0):.2f} EUR")
                print(f"    - Yearly cost: {stats.get('total_yearly_cost', 0):.2f} EUR")
                
                if 'by_category' in stats:
                    print(f"    - By category:")
                    for category, data in stats['by_category'].items():
                        print(f"      * {category}: {data['count']} contracts, {data['monthly_cost']:.2f} EUR/month")
                
                return True
            else:
                print(f"  ❌ Get statistics failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Statistics test failed: {e}")
            return False
    
    def test_pdf_export(self):
        """Test PDF export - MAIN FOCUS"""
        print("\n=== PDF EXPORT TEST (MAIN FOCUS) ===")
        
        try:
            response = self.session.get(f"{self.base_url}/export/pdf")
            print(f"✓ GET /export/pdf - Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check headers
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                print(f"  ✓ PDF export successful")
                print(f"    - Content-Type: {content_type}")
                print(f"    - Content-Disposition: {content_disposition}")
                print(f"    - Content length: {len(response.content)} bytes")
                
                # Verify it's actually a PDF
                if response.content.startswith(b'%PDF'):
                    print(f"  ✓ Valid PDF file returned")
                    return True
                else:
                    print(f"  ❌ Response is not a valid PDF file")
                    return False
            else:
                print(f"  ❌ PDF export failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ PDF export test failed: {e}")
            return False
    
    def test_excel_export(self):
        """Test Excel export - MAIN FOCUS"""
        print("\n=== EXCEL EXPORT TEST (MAIN FOCUS) ===")
        
        try:
            response = self.session.get(f"{self.base_url}/export/excel")
            print(f"✓ GET /export/excel - Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check headers
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                print(f"  ✓ Excel export successful")
                print(f"    - Content-Type: {content_type}")
                print(f"    - Content-Disposition: {content_disposition}")
                print(f"    - Content length: {len(response.content)} bytes")
                
                # Verify it's actually an Excel file (check for ZIP signature as XLSX is a zip file)
                if response.content.startswith(b'PK'):  # ZIP file signature
                    print(f"  ✓ Valid Excel file returned")
                    return True
                else:
                    print(f"  ❌ Response is not a valid Excel file")
                    print(f"  First 50 bytes: {response.content[:50]}")
                    return False
            else:
                print(f"  ❌ Excel export failed - Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Excel export test failed: {e}")
            return False
    
    def test_delete_operations(self):
        """Test delete operations"""
        print("\n=== DELETE OPERATIONS TESTS ===")
        
        try:
            # Delete a contract
            if self.created_contracts:
                contract_id = self.created_contracts[-1]  # Delete the last one
                response = self.session.delete(f"{self.base_url}/contracts/{contract_id}")
                print(f"✓ DELETE /contracts/{contract_id} - Status: {response.status_code}")
                
                if response.status_code == 200:
                    print(f"  ✓ Contract deleted successfully")
                    self.created_contracts.remove(contract_id)
                else:
                    print(f"  ❌ Delete contract failed - Status: {response.status_code}")
                    return False
            
            # Delete a family member (should unlink from contracts)
            if self.created_family_members:
                member_id = self.created_family_members[-1]  # Delete the last one
                response = self.session.delete(f"{self.base_url}/family-members/{member_id}")
                print(f"✓ DELETE /family-members/{member_id} - Status: {response.status_code}")
                
                if response.status_code == 200:
                    print(f"  ✓ Family member deleted successfully")
                    print(f"  ✓ Associated contracts should be unlinked automatically")
                    self.created_family_members.remove(member_id)
                else:
                    print(f"  ❌ Delete family member failed - Status: {response.status_code}")
                    return False
                
                # Verify contracts are unlinked
                response = self.session.get(f"{self.base_url}/contracts")
                if response.status_code == 200:
                    contracts = response.json()
                    linked_contracts = [c for c in contracts if c.get('family_member_id') == member_id]
                    if not linked_contracts:
                        print(f"  ✓ Contracts successfully unlinked from deleted family member")
                    else:
                        print(f"  ❌ {len(linked_contracts)} contracts still linked to deleted family member")
                        return False
            
            return True
            
        except Exception as e:
            print(f"❌ Delete operations test failed: {e}")
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print("==============================================")
        print("    VERTRAGSMANAGER BACKEND API TESTS")
        print("==============================================")
        print(f"Testing API at: {self.base_url}")
        print(f"Test started at: {datetime.now()}")
        
        test_results = {}
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("User Registration", self.test_user_registration),
            ("User Login", self.test_user_login),
            ("Get Current User", self.test_get_current_user),
            ("Family Member CRUD", self.test_family_member_crud),
            ("Contract CRUD Operations", self.test_contract_crud),  # MAIN FOCUS
            ("Statistics API", self.test_statistics_api),
            ("PDF Export", self.test_pdf_export),  # MAIN FOCUS
            ("Excel Export", self.test_excel_export),  # MAIN FOCUS
            ("Delete Operations", self.test_delete_operations)
        ]
        
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*60}")
                result = test_func()
                test_results[test_name] = result
                if result:
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"❌ {test_name}: ERROR - {e}")
                test_results[test_name] = False
        
        # Summary
        print(f"\n{'='*60}")
        print("                    SUMMARY")
        print(f"{'='*60}")
        
        passed = sum(1 for result in test_results.values() if result)
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name:<30} {status}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} tests failed")
        
        return test_results

if __name__ == "__main__":
    tester = VertragsmanagerAPITester()
    results = tester.run_all_tests()