import './App.css'
import Content from './components/Content'
import Footer from './components/Footer'
import Header from './components/Header'

function App(props) {
    return (
        <>
            <div className='app'>
                <Header currentUserInfo={props.currentUserInfo} isLoggedIn={props.isLoggedIn} />
                <Content currentUserInfo={props.currentUserInfo} isLoggedIn={props.isLoggedIn} setCurrentUserInfo={props.setCurrentUserInfo} setIsLoggedIn={props.setIsLoggedIn} />
                <Footer />
            </div>
        </>
    )
}

export default App